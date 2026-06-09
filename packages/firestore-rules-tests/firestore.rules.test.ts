import fs from 'fs';
import path from 'path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';

import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'minimum-standards-test';

function readRules(): string {
  const rulesPath = path.resolve(__dirname, '../../firebase/firestore.rules');
  return fs.readFileSync(rulesPath, 'utf8');
}

type StandardOverride = Record<string, unknown>;

function buildStandardData(overrides: StandardOverride = {}) {
  return {
    activityId: 'a1',
    minimum: 100,
    unit: 'calls',
    cadence: { interval: 1, unit: 'week' },
    state: 'active',
    summary: '100 calls / week',
    sessionConfig: {
      sessionLabel: 'session',
      sessionsPerCadence: 1,
      volumePerSession: 100,
    },
    archivedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    ...overrides,
  };
}

describe('Firestore security rules: user isolation', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readRules() }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('denies unauthenticated read', async () => {
    const unauth = testEnv.unauthenticatedContext();
    const db = unauth.firestore();

    await assertFails(getDoc(doc(db, 'users/u1/activities/a1')));
  });

  test('denies cross-user read', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const u2 = testEnv.authenticatedContext('u2');

    const db1 = u1.firestore();
    const db2 = u2.firestore();

    await assertSucceeds(
      setDoc(doc(db1, 'users/u1/activities/a1'), {
        name: 'Sales Calls',
        unit: 'calls',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      })
    );

    await assertFails(getDoc(doc(db2, 'users/u1/activities/a1')));
  });

  test('allows authenticated user writes within their scope with server timestamps', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertSucceeds(
      setDoc(doc(db1, 'users/u1/standards/s1'), buildStandardData())
    );
  });

  test('allows authenticated user to save dashboard layout preferences', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertSucceeds(
      setDoc(doc(db1, 'users/u1/preferences/dashboardLayout'), {
        pages: [
          { id: 'page-1', name: 'Page 1', orderIndex: 0 },
          { id: 'page-2', name: 'Page 2', orderIndex: 1 },
        ],
        pageSize: 6,
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('denies dashboard layout preferences with an unsupported page size', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertFails(
      setDoc(doc(db1, 'users/u1/preferences/dashboardLayout'), {
        pages: [{ id: 'page-1', name: 'Page 1', orderIndex: 0 }],
        pageSize: 12,
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('allows updating synced dashboard placement fields on standards', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');

    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    await assertSucceeds(
      updateDoc(standardRef, {
        dashboardPageId: 'page-2',
        dashboardOrderIndex: 0,
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('denies writes with unexpected fields', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertFails(
      setDoc(doc(db1, 'users/u1/activities/a1'), {
        name: 'Sales Calls',
        unit: 'calls',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        ownerId: 'u1'
      })
    );
  });

  test('prevents log creation for archived standards', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertSucceeds(
      setDoc(
        doc(db1, 'users/u1/standards/s1'),
        buildStandardData({
          state: 'archived',
          archivedAt: serverTimestamp(),
        })
      )
    );

    await assertFails(
      setDoc(doc(db1, 'users/u1/activityLogs/log-1'), {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );
  });

  test('allows archiving an active standard', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');

    await assertSucceeds(
      setDoc(standardRef, buildStandardData())
    );

    const existingDoc = await getDoc(standardRef);
    const existingData = existingDoc.data();

    await assertSucceeds(
      setDoc(standardRef, {
        ...existingData,
        state: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('blocks updates while a standard remains archived', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');

    await assertSucceeds(
      setDoc(
        standardRef,
        buildStandardData({
          state: 'archived',
          archivedAt: serverTimestamp(),
        })
      )
    );

    const archivedDoc = await getDoc(standardRef);
    const archivedData = archivedDoc.data();

    await assertFails(
      setDoc(standardRef, {
        ...archivedData,
        minimum: 250,
        updatedAt: serverTimestamp()
      })
    );
  });

  test('allows unarchiving a standard', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');

    await assertSucceeds(
      setDoc(
        standardRef,
        buildStandardData({
          state: 'archived',
          archivedAt: serverTimestamp(),
        })
      )
    );

    const archivedDoc = await getDoc(standardRef);
    const archivedData = archivedDoc.data();

    await assertSucceeds(
      setDoc(standardRef, {
        ...archivedData,
        state: 'active',
        archivedAt: null,
        updatedAt: serverTimestamp()
      })
    );
  });

  test('allows saving a standard with a weekday period start preference', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertSucceeds(
      setDoc(
        doc(db1, 'users/u1/standards/s1'),
        buildStandardData({
          periodStartPreference: {
            mode: 'weekDay',
            weekStartDay: 3,
          },
        })
      )
    );
  });

  test('rejects an invalid period start preference payload', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();

    await assertFails(
      setDoc(
        doc(db1, 'users/u1/standards/s1'),
        buildStandardData({
          periodStartPreference: {
            mode: 'weekDay',
            weekStartDay: 9,
          },
        })
      )
    );
  });

  describe('activityHistory rules', () => {
    test('allows owner to create activityHistory with valid payload', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600000';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const validPayload = {
        id: docId,
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600000,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 5,
            volumePerSession: 20
          },
          summary: '100 calls / week'
        },
        total: 50,
        currentSessions: 2,
        targetSessions: 5,
        status: 'In Progress',
        progressPercent: 50,
        generatedAtMs: Date.now(),
        source: 'boundary'
      };

      await assertSucceeds(setDoc(historyRef, validPayload));
    });

    test('allows owner to create activityHistory with log-edit source', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600002';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const payload = {
        id: docId,
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600002,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 5,
            volumePerSession: 20,
          },
          summary: '100 calls / week',
        },
        total: 75,
        currentSessions: 3,
        targetSessions: 5,
        status: 'In Progress',
        progressPercent: 75,
        generatedAtMs: Date.now(),
        source: 'log-edit',
      };

      await assertSucceeds(setDoc(historyRef, payload));
    });

    test('allows targetSessions to be zero when standard uses volume-only tracking', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600001';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const zeroSessionsPayload = {
        id: docId,
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600001,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 0,
            volumePerSession: 0,
          },
          summary: '100 calls / week',
        },
        total: 100,
        currentSessions: 0,
        targetSessions: 0,
        status: 'Met',
        progressPercent: 100,
        generatedAtMs: Date.now(),
        source: 'boundary',
      };

      await assertSucceeds(setDoc(historyRef, zeroSessionsPayload));
    });

    test('denies create with extra fields in document', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600000';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const invalidPayload = {
        id: docId,
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600000,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 5,
            volumePerSession: 20
          },
          summary: '100 calls / week'
        },
        total: 50,
        currentSessions: 2,
        targetSessions: 5,
        status: 'In Progress',
        progressPercent: 50,
        generatedAtMs: Date.now(),
        source: 'boundary',
        extraField: 'should fail'
      };

      await assertFails(setDoc(historyRef, invalidPayload));
    });

    test('denies create with extra fields in standardSnapshot', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600000';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const invalidPayload = {
        id: docId,
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600000,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 5,
            volumePerSession: 20
          },
          summary: '100 calls / week',
          extraField: 'should fail'
        },
        total: 50,
        currentSessions: 2,
        targetSessions: 5,
        status: 'In Progress',
        progressPercent: 50,
        generatedAtMs: Date.now(),
        source: 'boundary'
      };

      await assertFails(setDoc(historyRef, invalidPayload));
    });

    test('denies create with mismatched id', async () => {
      const u1 = testEnv.authenticatedContext('u1');
      const db1 = u1.firestore();
      const docId = 'a1__s1__1736121600000';
      const historyRef = doc(db1, `users/u1/activityHistory/${docId}`);

      const invalidPayload = {
        id: 'different-id',
        activityId: 'a1',
        standardId: 's1',
        referenceTimestampMs: 1736121600000,
        standardSnapshot: {
          minimum: 100,
          unit: 'calls',
          cadence: { interval: 1, unit: 'week' },
          sessionConfig: {
            sessionLabel: 'call',
            sessionsPerCadence: 5,
            volumePerSession: 20
          },
          summary: '100 calls / week'
        },
        total: 50,
        currentSessions: 2,
        targetSessions: 5,
        status: 'In Progress',
        progressPercent: 50,
        generatedAtMs: Date.now(),
        source: 'boundary'
      };

      await assertFails(setDoc(historyRef, invalidPayload));
    });
  });
});

describe('Firestore security rules: activity log updates', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readRules() }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('allows updating editedAt field on log entry', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');
    const logRef = doc(db1, 'users/u1/activityLogs/log-1');

    // Create an active standard
    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    // Create a log entry
    await assertSucceeds(
      setDoc(logRef, {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );

    const logDoc = await getDoc(logRef);
    const logData = logDoc.data();

    // Update editedAt field
    await assertSucceeds(
      updateDoc(logRef, {
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('allows updating deletedAt field on log entry', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');
    const logRef = doc(db1, 'users/u1/activityLogs/log-1');

    // Create an active standard
    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    // Create a log entry
    await assertSucceeds(
      setDoc(logRef, {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );

    // Soft-delete by setting deletedAt
    await assertSucceeds(
      updateDoc(logRef, {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );

    // Restore by clearing deletedAt
    await assertSucceeds(
      updateDoc(logRef, {
        deletedAt: null,
        updatedAt: serverTimestamp()
      })
    );
  });

  test('allows updating value, note, and occurredAt fields', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');
    const logRef = doc(db1, 'users/u1/activityLogs/log-1');

    // Create an active standard
    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    // Create a log entry
    await assertSucceeds(
      setDoc(logRef, {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );

    // Update value, note, and occurredAt
    await assertSucceeds(
      updateDoc(logRef, {
        value: 20,
        note: 'Updated note',
        occurredAt: serverTimestamp(),
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('prevents updating createdAt field', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');
    const logRef = doc(db1, 'users/u1/activityLogs/log-1');

    // Create an active standard
    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    // Create a log entry
    await assertSucceeds(
      setDoc(logRef, {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );

    const logDoc = await getDoc(logRef);
    const logData = logDoc.data();

    // Attempt to change createdAt should fail
    await assertFails(
      updateDoc(logRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('prevents updating standardId field', async () => {
    const u1 = testEnv.authenticatedContext('u1');
    const db1 = u1.firestore();
    const standardRef = doc(db1, 'users/u1/standards/s1');
    const logRef = doc(db1, 'users/u1/activityLogs/log-1');

    // Create an active standard
    await assertSucceeds(setDoc(standardRef, buildStandardData()));

    // Create a log entry
    await assertSucceeds(
      setDoc(logRef, {
        standardId: 's1',
        value: 10,
        occurredAt: serverTimestamp(),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editedAt: null,
        deletedAt: null
      })
    );

    // Attempt to change standardId should fail
    await assertFails(
      updateDoc(logRef, {
        standardId: 's2',
        updatedAt: serverTimestamp()
      })
    );
  });
});
