const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');
const gh = require('./gh');

const { getUserData } = require('./userdata');

async function createRegistrations(count, callback) {
  let latestToken = "None";
  core.debug("Callback: " + callback);
  const registrations = [... new Array(count).keys()].map(async (i) => {
    core.info("Generating user-data for runner id: " + i);
    let githubRegistrationToken = await gh.getRegistrationToken();

    // This is needed because GitHub will return the same token if not used
    while (latestToken == githubRegistrationToken) {
      core.warning("Got the same token, waiting for a different one...");
      githubRegistrationToken = await gh.getRegistrationToken();
    }
    latestToken = githubRegistrationToken;

    core.info("Latest token is: " + latestToken);
    let registration = callback(i, githubRegistrationToken);
    return registration;
  });

  return await Promise.all(registrations);
}

async function startEc2Instance(label) {
  const ec2 = new AWS.EC2();

  const userDataBase64 = await getUserData(config.input.os, label, createRegistrations);

  const params = {
    ImageId: config.input.ec2ImageId,
    InstanceType: config.input.ec2InstanceType,
    MinCount: 1,
    MaxCount: 1,
    UserData: userDataBase64,
    // SubnetId: config.input.subnetId,
    // SecurityGroupIds: [config.input.securityGroupId],
    IamInstanceProfile: { Name: config.input.iamRoleName },
    TagSpecifications: config.tagSpecifications,
    KeyName: config.input.keyPair,
    NetworkInterfaces: [
      {
        AssociatePublicIpAddress: true,
        DeleteOnTermination: true,
        DeviceIndex: 0,
        SubnetId: config.input.subnetId,
        Groups: [config.input.securityGroupId]
      }
    ],
    BlockDeviceMappings: [
      {
        DeviceName: '/dev/sda1',
        Ebs: {
          DeleteOnTermination: true,
          VolumeSize: 640,
          // VolumeType: 'io1',
          // Iops: 32000
        }
      }
    ]
  };

  try {
    const result = await ec2.runInstances(params).promise();
    const ec2InstanceId = result.Instances[0].InstanceId;
    core.info(`AWS EC2 instance ${ec2InstanceId} is started`);
    return ec2InstanceId;
  } catch (error) {
    core.error('AWS EC2 instance starting error');
    throw error;
  }
}

async function terminateEc2Instance() {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [config.input.ec2InstanceId],
  };

  try {
    await ec2.terminateInstances(params).promise();
    core.info(`AWS EC2 instance ${config.input.ec2InstanceId} is terminated`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${config.input.ec2InstanceId} termination error`);
    throw error;
  }
}

async function waitForInstanceRunning(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.waitFor('instanceRunning', params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is up and running`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} initialization error`);
    throw error;
  }
}

module.exports = {
  startEc2Instance,
  terminateEc2Instance,
  waitForInstanceRunning,
};
