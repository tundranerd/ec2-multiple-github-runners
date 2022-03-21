const config = require('../config');
 
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
].join("\n");

function createRegistration(label, i, githubRegistrationToken) {
  return [
    // Create runner dir
    `mkdir C:\\runner-${i}; cd C:\\runner-${i}`,
    // Extract runner .zip
    'Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory("C:/TEMP/actions-runner-win-x64-2.280.3.zip", "$PWD")',
    // Configure the runner for the current repo
    `.\\config.cmd --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label} --name ${label}-${i} --unattended`,
    // Run it!
    'start-process -Filepath run.cmd'
  ].join("\n");
}

  
const postMetadata = "</powershell>";



function getUserData(label, createRegistrations) {

  const registrationCallback = (i, githubRegistrationToken) => {
    return createRegistration(label, i, githubRegistrationToken);
  };

  const { input: { count } } = config;

  const registrations = createRegistrations(count, registrationCallback).join("\n");

  const vanillaAMIUserData = [
     preMetadata,
     scheduleEmergencyShutdown,
     globalConfig,
     registrations,
     postMetadata
  ].join("\n");

  return Buffer.from(vanillaAMIUserData).toString('base64');
}

module.exports = {
  getUserData
}
