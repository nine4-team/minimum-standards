import { buildGoogleSignInConfig } from '../googleSignIn';

describe('googleSignIn', () => {
  test('configures iOS with web client id for Firebase id tokens', () => {
    expect(
      buildGoogleSignInConfig({
        platform: 'ios',
        webClientId: 'web-client.apps.googleusercontent.com',
        iosClientId: 'ios-client.apps.googleusercontent.com',
      })
    ).toEqual({
      webClientId: 'web-client.apps.googleusercontent.com',
      iosClientId: 'ios-client.apps.googleusercontent.com',
      offlineAccess: false,
      scopes: ['email', 'profile'],
    });
  });

  test('does not pass ios client id on Android', () => {
    expect(
      buildGoogleSignInConfig({
        platform: 'android',
        webClientId: 'web-client.apps.googleusercontent.com',
        iosClientId: 'ios-client.apps.googleusercontent.com',
      })
    ).toEqual({
      webClientId: 'web-client.apps.googleusercontent.com',
      offlineAccess: false,
      scopes: ['email', 'profile'],
    });
  });
});
