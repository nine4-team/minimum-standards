import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SuggestorFlowParamList } from './types';
import { SuggestorInputStep } from '../screens/suggestor/SuggestorInputStep';
import { SuggestorActivityStep } from '../screens/suggestor/SuggestorActivityStep';
import { SuggestorUnitStep } from '../screens/suggestor/SuggestorUnitStep';

const Stack = createNativeStackNavigator<SuggestorFlowParamList>();

export function SuggestorFlow() {
  return (
    <Stack.Navigator
      initialRouteName="SuggestorInput"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SuggestorInput" component={SuggestorInputStep} />
      <Stack.Screen name="SuggestorActivity" component={SuggestorActivityStep} />
      <Stack.Screen name="SuggestorUnit" component={SuggestorUnitStep} />
    </Stack.Navigator>
  );
}
