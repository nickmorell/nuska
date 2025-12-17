// export default {
//     preset: 'ts-jest',
//     testEnvironment: 'node',
//     roots: ['<rootDir>'],
//     testMatch: [
//         '<rootDir>/tests/**/*.test.ts',
//         '<rootDir>/tests/**/*.spec.ts'
//     ],
//     moduleFileExtensions: ['ts', 'js', 'json'],
//     collectCoverageFrom: [
//         'src/**/*.ts',
//         '!src/**/*.d.ts',
//     ],
//     projects: [
//         {
//             displayName: 'unit',
//             testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
//         },
//         {
//             displayName: 'integration', 
//             testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
//         },
//     ],
// };

export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testRegex: ['__tests__\\.(ts|tsx)$', '.*\\.(test|spec)\\.(ts|tsx)$'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
    ],
};