import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import crypto from 'crypto';
import { hashPassword } from './auth';
import type { CustomEvent, User } from './types';

export interface MongoEventDoc extends Omit<CustomEvent, 'id'> {
  _id?: string;
  id: string;
}

export interface MongoUserDoc extends Omit<User, 'id'> {
  _id?: string;
  id: string;
}

// Interface representing standard MongoDB Collection operations
export interface IMongoCollection<T extends { id: string }> {
  find(filter?: Record<string, any>): { toArray(): Promise<T[]> };
  findOne(filter: Record<string, any>): Promise<T | null>;
  insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }>;
  updateOne(filter: Record<string, any>, update: { $set?: Partial<T> }): Promise<{ matchedCount: number; modifiedCount: number }>;
  deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number; acknowledged: boolean }>;
  countDocuments(filter?: Record<string, any>): Promise<number>;
  createIndex(indexSpec: Record<string, number>, options?: Record<string, any>): Promise<string>;
}

// In-Memory MongoDB-compatible Collection for resilience in sandboxed environments
class InMemoryMongoCollection<T extends { id: string }> implements IMongoCollection<T> {
  private docs: Map<string, T> = new Map();
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  find(filter: Record<string, any> = {}): { toArray(): Promise<T[]> } {
    const all = Array.from(this.docs.values());
    const matches = all.filter((doc) => {
      for (const [key, val] of Object.entries(filter)) {
        const docVal = (doc as any)[key];
        if (val !== undefined && val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
          // Check MongoDB operators
          if ('$regex' in val) {
            const re = new RegExp(val.$regex, val.$options || 'i');
            if (typeof docVal !== 'string' || !re.test(docVal)) return false;
          }
          if ('$gte' in val && (docVal === undefined || docVal < val.$gte)) return false;
          if ('$lte' in val && (docVal === undefined || docVal > val.$lte)) return false;
          if ('$gt' in val && (docVal === undefined || docVal <= val.$gt)) return false;
          if ('$lt' in val && (docVal === undefined || docVal >= val.$lt)) return false;
          if ('$in' in val && Array.isArray(val.$in) && !val.$in.includes(docVal)) return false;
          if ('$ne' in val && docVal === val.$ne) return false;
        } else if (val !== undefined) {
          if (docVal !== val) return false;
        }
      }
      return true;
    });
    return {
      toArray: async () => matches,
    };
  }

  async findOne(filter: Record<string, any>): Promise<T | null> {
    const list = await this.find(filter).toArray();
    return list[0] || null;
  }

  async insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }> {
    const id = doc.id || `doc_${crypto.randomUUID().slice(0, 8)}`;
    const cloned = { ...doc, id };
    this.docs.set(id, cloned);
    return { insertedId: id, acknowledged: true };
  }

  async updateOne(filter: Record<string, any>, update: { $set?: Partial<T> }): Promise<{ matchedCount: number; modifiedCount: number }> {
    const existing = await this.findOne(filter);
    if (!existing) return { matchedCount: 0, modifiedCount: 0 };
    const updated = { ...existing, ...(update.$set || {}) };
    this.docs.set(existing.id, updated);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number; acknowledged: boolean }> {
    const existing = await this.findOne(filter);
    if (!existing) return { deletedCount: 0, acknowledged: true };
    this.docs.delete(existing.id);
    return { deletedCount: 1, acknowledged: true };
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    const list = await this.find(filter).toArray();
    return list.length;
  }

  async createIndex(indexSpec: Record<string, number>, _options?: Record<string, any>): Promise<string> {
    const name = Object.keys(indexSpec).join('_');
    return `${this.name}_${name}`;
  }
}

// Native MongoDB Collection adapter for real external MongoDB instances
class NativeMongoCollection<T extends { id: string }> implements IMongoCollection<T> {
  private col: any;
  constructor(col: any) {
    this.col = col;
  }

  find(filter: Record<string, any> = {}): { toArray(): Promise<T[]> } {
    return {
      toArray: async () => {
        const docs = await this.col.find(filter).toArray();
        return docs.map((d: any) => {
          const { _id, ...rest } = d;
          return rest as T;
        });
      },
    };
  }

  async findOne(filter: Record<string, any>): Promise<T | null> {
    const doc = await this.col.findOne(filter);
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest as T;
  }

  async insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }> {
    const id = doc.id || `doc_${crypto.randomUUID().slice(0, 8)}`;
    const cloned = { ...doc, id };
    const res = await this.col.insertOne({ ...cloned, _id: id });
    return { insertedId: id, acknowledged: res.acknowledged };
  }

  async updateOne(filter: Record<string, any>, update: { $set?: Partial<T> }): Promise<{ matchedCount: number; modifiedCount: number }> {
    const res = await this.col.updateOne(filter, update);
    return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
  }

  async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number; acknowledged: boolean }> {
    const res = await this.col.deleteOne(filter);
    return { deletedCount: res.deletedCount, acknowledged: res.acknowledged };
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    return this.col.countDocuments(filter);
  }

  async createIndex(indexSpec: Record<string, number>, options?: Record<string, any>): Promise<string> {
    return this.col.createIndex(indexSpec, options);
  }
}

class MongoService {
  public isConnectedToNativeMongo = false;
  public mongoClient: MongoClient | null = null;
  public nativeDb: Db | null = null;

  public eventsCollection: IMongoCollection<MongoEventDoc>;
  public usersCollection: IMongoCollection<MongoUserDoc>;

  constructor() {
    this.eventsCollection = new InMemoryMongoCollection<MongoEventDoc>('events');
    this.usersCollection = new InMemoryMongoCollection<MongoUserDoc>('users');
  }

  public async init(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (mongoUri) {
      try {
        console.log(`Connecting to MongoDB at ${redactMongoUri(mongoUri)}...`);
        const client = new MongoClient(mongoUri, {
          serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
          },
          serverSelectionTimeoutMS: 5000,
        });
        await client.connect();
        this.mongoClient = client;
        this.nativeDb = client.db(process.env.MONGODB_DB || 'custom_timetable');
        this.isConnectedToNativeMongo = true;
        console.log('Successfully connected to native MongoDB server!');

        const nativeEvents = this.nativeDb.collection<MongoEventDoc>('events');
        const nativeUsers = this.nativeDb.collection<MongoUserDoc>('users');
        this.eventsCollection = new NativeMongoCollection<MongoEventDoc>(nativeEvents);
        this.usersCollection = new NativeMongoCollection<MongoUserDoc>(nativeUsers);
        await nativeEvents.createIndex({ userId: 1, startTime: 1 });
        await nativeEvents.createIndex({ userId: 1, category: 1 });
        await nativeUsers.createIndex({ email: 1 }, { unique: true });
        await nativeUsers.createIndex({ id: 1 }, { unique: true });
      } catch (err: any) {
        console.warn('Native MongoDB connection failed, using resilient embedded MongoDB storage:', err.message);
        this.isConnectedToNativeMongo = false;
      }
    } else {
      console.log('No external MONGODB_URI detected; running embedded MongoDB engine.');
    }

    await this.seedInitialDocuments();
  }

  private async seedInitialDocuments() {
    // Seed Alice & Bob users
    const alice: MongoUserDoc = {
      id: 'alice',
      email: 'alice@connect.ust.hk',
      name: 'Alice',
      studentId: '20781234',
      department: 'Computer Science & Engineering',
      passwordHash: hashPassword('alice123'),
      createdAt: '2026-09-01T00:00:00.000Z',
    };

    const bob: MongoUserDoc = {
      id: 'bob',
      email: 'bob@connect.ust.hk',
      name: 'Bob',
      studentId: '20854321',
      department: 'Electronic & Computer Engineering',
      passwordHash: hashPassword('bob123'),
      createdAt: '2026-09-01T00:00:00.000Z',
    };

    await this.insertIfMissing(this.usersCollection, alice);
    await this.insertIfMissing(this.usersCollection, bob);

    // Seed events
    const seedEvents: MongoEventDoc[] = [
      {
        id: 'evt_alice_1',
        userId: 'alice',
        title: 'COMP 3511 Operating Systems Project Meeting',
        description: 'Sprint planning and CPU scheduler milestone review with team.',
        location: 'Library LG4 Discussion Room 12',
        category: 'meeting',
        color: '#2563eb',
        startTime: '2026-09-22T14:30:00.000Z',
        endTime: '2026-09-22T16:00:00.000Z',
        allDay: false,
        reminders: [15, 60],
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: '2026-09-15T09:00:00.000Z',
      },
      {
        id: 'evt_alice_2',
        userId: 'alice',
        title: 'COMP 3711 Algorithm Analysis Study Group',
        description: 'Dynamic programming & graph cut problems practice.',
        location: 'Academic Building Rm 2464',
        category: 'study',
        color: '#7c3aed',
        startTime: '2026-09-23T10:00:00.000Z',
        endTime: '2026-09-23T12:00:00.000Z',
        allDay: false,
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          byDay: ['WE'],
          until: '2026-12-15T23:59:59.000Z',
        },
        reminders: [30],
        createdAt: '2026-09-15T10:00:00.000Z',
        updatedAt: '2026-09-15T10:00:00.000Z',
      },
      {
        id: 'evt_alice_3',
        userId: 'alice',
        title: 'MATH 2111 Matrix Algebra Revision',
        description: 'Eigenvalues and Jordan normal form.',
        location: 'Coffee Shop G/F',
        category: 'study',
        color: '#d97706',
        startTime: '2026-09-24T15:00:00.000Z',
        endTime: '2026-09-24T17:00:00.000Z',
        allDay: false,
        createdAt: '2026-09-16T11:00:00.000Z',
        updatedAt: '2026-09-16T11:00:00.000Z',
      },
      {
        id: 'evt_alice_4',
        userId: 'alice',
        title: 'Gym & Swimming Workout',
        description: 'HKUST Seafront Swimming Pool session.',
        location: 'Indoor Swimming Pool & Sports Center',
        category: 'personal',
        color: '#059669',
        startTime: '2026-09-25T17:30:00.000Z',
        endTime: '2026-09-25T19:00:00.000Z',
        allDay: false,
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          byDay: ['FR'],
          until: '2026-12-15T23:59:59.000Z',
        },
        createdAt: '2026-09-16T12:00:00.000Z',
        updatedAt: '2026-09-16T12:00:00.000Z',
      },
      {
        id: 'evt_bob_1',
        userId: 'bob',
        title: 'ELEC 3300 Embedded Systems Lab Session',
        description: 'FPGA verilog synthesis & oscilloscope measurement test.',
        location: 'Room 2404 Academic Building',
        category: 'lab',
        color: '#dc2626',
        startTime: '2026-09-22T09:00:00.000Z',
        endTime: '2026-09-22T12:00:00.000Z',
        allDay: false,
        createdAt: '2026-09-16T08:00:00.000Z',
        updatedAt: '2026-09-16T08:00:00.000Z',
      },
      {
        id: 'evt_bob_2',
        userId: 'bob',
        title: 'Robomaster Team Weekly Sync',
        description: 'Gimbal control PID tuning and motor CAN-bus diagnostics.',
        location: 'Undergraduate Robotics Lab 3311',
        category: 'meeting',
        color: '#2563eb',
        startTime: '2026-09-24T19:00:00.000Z',
        endTime: '2026-09-24T21:30:00.000Z',
        allDay: false,
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          byDay: ['TH'],
          until: '2026-12-15T23:59:59.000Z',
        },
        createdAt: '2026-09-16T08:30:00.000Z',
        updatedAt: '2026-09-16T08:30:00.000Z',
      },
    ];

    for (const evt of seedEvents) {
      await this.insertIfMissing(this.eventsCollection, evt);
    }

    console.log(`MongoDB collections initialized with ${seedEvents.length} events and 2 users.`);
  }

  private async insertIfMissing<T extends { id: string }>(collection: IMongoCollection<T>, doc: T): Promise<void> {
    const existing = await collection.findOne({ id: doc.id });
    if (!existing) {
      await collection.insertOne(doc);
    }
  }
}

function redactMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<redacted MongoDB URI>';
  }
}

export const mongoService = new MongoService();
