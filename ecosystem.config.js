module.exports = {
  apps: [
    {
      name: 'api-service',
      script: 'npm',
      args: 'start',
      cwd: './api-service',
      env: { PORT: 3000 }
    },
    {
      name: 'telephony-gateway',
      script: 'npm',
      args: 'start',
      cwd: './telephony-gateway',
      env: { PORT: 3001 }
    },
    {
      name: 'call-worker',
      script: 'npm',
      args: 'start',
      cwd: './call-worker'
    },
    {
      name: 'evaluation-api',
      script: 'npm',
      args: 'run start:api',
      cwd: './call-evaluation-service',
      env: { PORT: 4000 }
    },
    {
      name: 'evaluation-worker',
      script: 'npm',
      args: 'run start:workers',
      cwd: './call-evaluation-service'
    }
  ]
};
