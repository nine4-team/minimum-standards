import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SuggestorFlowParamList } from './types';
import { SuggestorChatScreen } from '../screens/suggestor/SuggestorChatScreen';

const Stack = createNativeStackNavigator<SuggestorFlowParamList>();

export function SuggestorFlow() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SuggestorChat" component={SuggestorChatScreen} />
    </Stack.Navigator>
  );
}
