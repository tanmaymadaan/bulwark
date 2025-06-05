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
        'plugin:@typescript-eslint/recommended',
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
            files: ['src/**/*.ts'],
            extends: [
                'plugin:@typescript-eslint/recommended-requiring-type-checking',
            ],
            parserOptions: {
                project: './tsconfig.json',
            },
            rules: {
                '@typescript-eslint/prefer-readonly': 'error',
                '@typescript-eslint/strict-boolean-expressions': 'error',
            },
        },
        {
            files: ['**/*.test.ts', '**/*.spec.ts'],
            env: {
                jest: true,
            },
            parserOptions: {
                project: null, // Don't use TypeScript project for test files
            },
            rules: {
                // Relax some rules for test files
                '@typescript-eslint/no-explicit-any': 'off',
                'require-jsdoc': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                'no-console': 'off',
            },
        },
    ],
}; 