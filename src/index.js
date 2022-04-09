const aws = require('./aws');
const gh = require('./gh');
const config = require('./config');
const core = require('@actions/core');



async function start(mode) {

  // Generate random runner name
  const label = config.generateUniqueLabel();

  // Start the AWS EC2 machine
  const ec2InstanceId = await aws.startEc2Instance(label);

  // Number of runners to install in the build machine
  // Generally number of cores / 2 is recommended
  const count = config.input.count;

  // Set return values of the Action
  core.setOutput('label', label);
  core.setOutput('ec2-instance-id', ec2InstanceId);

  // Wait for the instance to boot up successfully
  await aws.waitForInstanceRunning(ec2InstanceId);

  core.info(`Startup Label: ${label}`);
  const { waitForRegistryTimeout } = config.input;
  await gh.waitForRunnerRegistered(mode, label, waitForRegistryTimeout);
}

async function stop(mode) {

  // Stop the AWS EC2 machine
  await aws.terminateEc2Instance();

  // Number of machines that were spawned before
  const spawnedCount = config.input.spawnedCount;

  // Base label used by the previous machine
  const label = config.input.label;

  core.info(`Shutdown Label: ${label}`);

  try {
    const { waitForDeRegistryTimeout } = config.input;
    await gh.waitForRunnerRegistered(mode, label, waitForDeRegistryTimeout);
    await gh.removeRunner(label);
  } catch(error) {
    core.warning(error);
  }
}

(async function () {
  try {
    const { mode } = config.input;
    mode === 'start' ? await start(mode) : await stop(mode);
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
})();
