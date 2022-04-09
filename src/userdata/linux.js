const config = require('../config');
const core = require('@actions/core');

const globalConfig = [
      '#!/bin/bash',
      'apt-get update && apt-get install libicu60 -y',
      'mkdir /tmp && cd /tmp',
      'case $(uname -m) in aarch64) ARCH="arm64" ;; amd64|x86_64) ARCH="x64" ;; esac && export RUNNER_ARCH=${ARCH}',
      'curl -O -L https://github.com/actions/runner/releases/download/v2.286.0/actions-runner-linux-${RUNNER_ARCH}-2.286.0.tar.gz',
      'export RUNNER_ALLOW_RUNASROOT=1',
].join("\n");

function createRegistration(label, i, githubRegistrationToken) {
  return [
      `mkdir /tmp/runner-${i} && cd /tmp/runner-${i}`,
      `tar xzf /tmp/actions-runner-linux-\${RUNNER_ARCH}-2.286.0.tar.gz -C /tmp/runner-${i}`,
      `./config.sh --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --name ${label} --unattended`,
      './run.sh 2>&1 &'
  ].join("\n");
}

async function getUserData(label, createRegistrations) {
  const registrationCallback = (githubRegistrationToken) => {
    return createRegistration(label, githubRegistrationToken);
  };

  const registrations = await createRegistrations(registrationCallback)

  const vanillaAMIUserData = [
    globalConfig,
    registrations.join("\n"),
  ].join("\n");

  core.debug(`AMI userdata: ${vanillaAMIUserData}`);

  return Buffer.from(vanillaAMIUserData).toString('base64');
}

module.exports = {
  getUserData
}
