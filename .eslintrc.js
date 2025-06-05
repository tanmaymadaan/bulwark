module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint', 'prettier'],
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        '@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
    ],
    rules: {
        // Prettier integration
        'prettier/prettier': 'error',

        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for this project
        '@typescript-eslint/strict-boolean-expressions': 'error',

        // General code quality rules
        'no-console': 'warn',
        'no-debugger': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-template': 'error',

        // Documentation requirements
        'require-jsdoc': [
            'error',
            {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                    ClassDeclaration: true,
                    ArrowFunctionExpression: false,
                    FunctionExpression: false,
                },
            },
        ],
        'valid-jsdoc': [
            'error',
            {
                requireReturn: true,
                requireReturnType: false, // TypeScript handles this
                requireParamDescription: true,
                requireReturnDescription: true,
            },
        ],
    },
    env: {
        node: true,
        es2020: true,
    },
    overrides: [
        {
            files: ['**/*.test.ts', '**/*.spec.ts'],
            env: {
                jest: true,
            },
            rules: {
                // Relax some rules for test files
                '@typescript-eslint/no-explicit-any': 'off',
                'require-jsdoc': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
            },
        },
    ],
}; 