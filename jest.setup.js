import '@testing-library/jest-native/extend-expect';

// Reanimated 4 importa react-native-worklets, cuyo módulo nativo no existe en
// jest: sin este mock, cualquier archivo que importe reanimated rompe la suite.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
