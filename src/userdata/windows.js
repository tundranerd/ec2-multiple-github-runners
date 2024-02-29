const config = require('../config');
const core = require('@actions/core');

const preMetadata = "<powershell>";
const scheduleEmergencyShutdown = "shutdown /s /t 5400"; // 1 hour and a half

const globalConfig = [
  // Create runner dir
  'mkdir C:\\actions-runner; cd C:\\actions-runner',
  // Download GitHub Runner
  'Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.313.0/actions-runner-win-x64-2.313.0.zip -OutFile actions-runner-win-x64-2.313.0.zip',
  // Check hash is good
  'if((Get-FileHash -Path actions-runner-win-x64-2.313.0.zip -Algorithm SHA256).Hash.ToUpper() -ne \'c4cb3e5d9f0ab42ddc224cfdf9fb705397a7b20fd321536da5500259225fdf8a\'.ToUpper()){ throw \'Computed checksum did not match\' }',
].join("\n");

function createRegistration(label, githubRegistrationToken) {
  return [
    // Extract runner .zip
    'Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64-2.313.0.zip", "$PWD")',
    // Configure the runner for the current repo
    `.\\config.cmd --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --name ${label} --unattended`,
    // Run it!
    'start-process -Filepath run.cmd'
  ].join("\n");
}

const postMetadata = "</powershell>";

async function getUserData(label, createRegistrations) {
  const registrationCallback = (githubRegistrationToken) => {
    return createRegistration(label, githubRegistrationToken);
  };

  const registrations = await createRegistrations(registrationCallback)

  const vanillaAMIUserData = [
    preMetadata,
    scheduleEmergencyShutdown,
    globalConfig,
    registrations.join("\n"),
    postMetadata
  ].join("\n");

  core.debug(`AMI userdata: ${vanillaAMIUserData}`);

  return Buffer.from(vanillaAMIUserData).toString('base64');
}

module.exports = {
  getUserData
}
