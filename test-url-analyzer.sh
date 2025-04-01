#!/bin/bash

# Run just the URL analyzer tests
node --experimental-vm-modules node_modules/jest/bin/jest.js server/__tests__/url-analyzer.test.ts