const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');
const gh = require('./gh');

async function startEc2Instance(label) {
  const ec2 = new AWS.EC2();


  const preMetadata = "<powershell>";

  const scheduleEmergencyShutdown = "shutdown /s /t 5400"; // 1 hour and a half

  const globalConfig = [
    // Install choco
    `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))`,
    // Install git
    'choco install -y git',
    // Add git to path
    '$env:Path += ";C:\\Program Files\\Git\\cmd"',
    // Enable fix for long > 260
    'git config --system core.longpaths true',
    // Download GitHub Runner temp dir
    `mkdir C:\\TEMP; cd C:\\TEMP`,
    // Download GitHub Runner
     'Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.280.3/actions-runner-win-x64-2.280.3.zip -OutFile actions-runner-win-x64-2.280.3.zip',
    // Check hash is good
    'if((Get-FileHash -Path actions-runner-win-x64-2.280.3.zip -Algorithm SHA256).Hash.ToUpper() -ne \'d45e44d3266539c92293de235b6eea3cb2dc21fe3e5b98fbf3cfa97d38bdad9f\'.ToUpper()){ throw \'Computed checksum did not match\' }',
  ]

  const customConfigs = [];

  let latestToken = "None";
  for (let i = 0; i < config.input.count; i++) {

    core.info("Generating user-data for runner id: " + i);
    let githubRegistrationToken = await gh.getRegistrationToken();

    // This is needed because GitHub will return the same token if not used
    while (latestToken == githubRegistrationToken) {
      core.warning("Got the same token, waiting for a different one...");
      githubRegistrationToken = await gh.getRegistrationToken();
    }
    latestToken = githubRegistrationToken;

    core.info("Latest token is: " + latestToken);

    const customConfig = [
      // Create runner dir
      `mkdir C:\\runner-${i}; cd C:\\runner-${i}`,
      // Extract runner .zip
      'Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory("C:/TEMP/actions-runner-win-x64-2.280.3.zip", "$PWD")',
      // Configure the runner for the current repo
      `.\\config.cmd --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --name ${label}-${i} --unattended`,
      // Run it!
      'start-process -Filepath run.cmd'
    ];

    customConfigs.push(customConfig.join("\n"))
  }

  

  const postMetadata = "</powershell>";


  const vanillaAMIUserData = preMetadata + "\n" + scheduleEmergencyShutdown + "\n" + globalConfig.join("\n") + "\n" + customConfigs.join("\n") + "\n" + postMetadata;
  core.info("UserData:");
  core.info(vanillaAMIUserData);

  const userDataBase64 = Buffer.from(vanillaAMIUserData).toString('base64');
  // const userDataBase64 = Buffer.from(userData).toString('base64');

  core.info("UserData Base64:");
  core.info(userDataBase64);

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
    KeyName: 'win',
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
