import { buildGoogleSignInConfig, resolveGoogleSignInClientIds } from '../googleSignIn';

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

  test('trims env client ids before configuring native Google sign in', () => {
    expect(
      resolveGoogleSignInClientIds({
        envWebClientId: ' web-client.apps.googleusercontent.com ',
        fallbackWebClientId: 'fallback-web.apps.googleusercontent.com',
        envIosClientId: ' ios-client.apps.googleusercontent.com ',
        fallbackIosClientId: 'fallback-ios.apps.googleusercontent.com',
      })
    ).toEqual({
      webClientId: 'web-client.apps.googleusercontent.com',
      iosClientId: 'ios-client.apps.googleusercontent.com',
    });
  });

  test('falls back when env client ids are empty after trimming', () => {
    expect(
      resolveGoogleSignInClientIds({
        envWebClientId: ' ',
        fallbackWebClientId: 'fallback-web.apps.googleusercontent.com',
        envIosClientId: '',
        fallbackIosClientId: 'fallback-ios.apps.googleusercontent.com',
      })
    ).toEqual({
      webClientId: 'fallback-web.apps.googleusercontent.com',
      iosClientId: 'fallback-ios.apps.googleusercontent.com',
    });
  });
});
