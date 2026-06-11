/* global jest */

const mockAuthInstance = {
  currentUser: { uid: 'test-user-id' },
  signOut: jest.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
  signInWithCredential: jest.fn(() => Promise.resolve()),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
};

const onAuthStateChanged = jest.fn((_authInstance, callback) => {
  callback(mockAuthInstance.currentUser);
  return jest.fn();
});

const signOut = jest.fn((authInstance) => authInstance.signOut());

const GoogleAuthProvider = {
  credential: jest.fn((_idToken, _accessToken) => ({
    providerId: 'google.com',
  })),
};

function getAuth() {
  return mockAuthInstance;
}

function auth() {
  return mockAuthInstance;
}

module.exports = {
  __esModule: true,
  default: auth,
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  __mockAuthInstance: mockAuthInstance,
};
