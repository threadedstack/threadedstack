import type { TDBFunctionInsert } from '@TDB/types'

import { EFunLanguage, Function as TDFunction } from '@tdsk/domain'
import { EndpointIds, FunctionIds, ProjectIds } from '@TDB/seeds/ids.seed'

export const functionsSeeds: TDBFunctionInsert[] = [
  new TDFunction({
    id: FunctionIds.acmeUserValidator,
    projectId: ProjectIds.acmeApi,
    endpointId: EndpointIds.acmeApiUsers,
    name: `User Data Validator`,
    description: `Validates user input before saving`,
    language: EFunLanguage.typescript,
    branch: `main`,
    content: `export async function validate(user: any) {
  if (!user.email || !user.email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (!user.name || user.name.length < 2) {
    throw new Error('Name too short');
  }
  return { valid: true };
}`,
    defaultArgs: [`{}`],
    dependencies: {
      zod: `^3.22.0`,
    },
  }),
  new TDFunction({
    id: FunctionIds.acmeAuth,
    projectId: ProjectIds.acmeApi,
    endpointId: EndpointIds.acmeApiUsers,
    name: `Auth Token Generator`,
    description: `Generates JWT tokens for authenticated users`,
    language: EFunLanguage.typescript,
    branch: `main`,
    content: `import jwt from 'jsonwebtoken';

export async function generateToken(userId: string) {
  const payload = { userId, timestamp: Date.now() };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}`,
    defaultArgs: [`user-123`],
    dependencies: {
      jsonwebtoken: `^9.0.0`,
    },
  }),
  new TDFunction({
    id: FunctionIds.startupAi,
    projectId: ProjectIds.startupAi,
    endpointId: EndpointIds.startupInference,
    name: `ML Prediction`,
    description: `Runs machine learning inference`,
    language: EFunLanguage.python,
    branch: `main`,
    content: `import numpy as np

def predict(input_data):
    # Mock ML prediction
    features = np.array(input_data)
    prediction = features.mean()
    return {"prediction": prediction, "confidence": 0.95}`,
    defaultArgs: [`[1, 2, 3, 4, 5]`],
    dependencies: {
      numpy: `>=1.24.0`,
      [`scikit-learn`]: `>=1.3.0`,
    },
  }),
  new TDFunction({
    id: FunctionIds.personal,
    projectId: ProjectIds.personal,
    endpointId: EndpointIds.personalTest,
    name: `Hello World`,
    description: `Simple test function`,
    language: EFunLanguage.javascript,
    branch: `main`,
    content: `export function hello(name = 'World') {
  return { message: \`Hello, \${name}!\` };
}`,
    defaultArgs: [],
    dependencies: {},
  }),
]
