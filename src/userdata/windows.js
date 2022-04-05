const config = require('../config');
const core = require('@actions/core');
 
const preMetadata = "<powershell>";
const scheduleEmergencyShutdown = "shutdown /s /t 5400"; // 1 hour and a half

const globalConfig = [
  // Download GitHub Runner temp dir
  `mkdir C:\\TEMP; cd C:\\TEMP`,
  // Download GitHub Runner
  'Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.280.3/actions-runner-win-x64-2.280.3.zip -OutFile actions-runner-win-x64-2.280.3.zip',
  // Check hash is good
  'if((Get-FileHash -Path actions-runner-win-x64-2.280.3.zip -Algorithm SHA256).Hash.ToUpper() -ne \'d45e44d3266539c92293de235b6eea3cb2dc21fe3e5b98fbf3cfa97d38bdad9f\'.ToUpper()){ throw \'Computed checksum did not match\' }',
].join("\n");

function createRegistration(label, githubRegistrationToken) {
  return [
    // Create runner dir
    `mkdir C:\\runner; cd C:\\runner`,
    // Extract runner .zip
    'Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory("C:/TEMP/actions-runner-win-x64-2.280.3.zip", "$PWD")',
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
