; Axiom Engine — instalador de Windows (Inno Setup 6)
; Compilar con scripts/build-installer.mjs

#ifndef MyAppVersion
  #define MyAppVersion "0.3.0"
#endif

#ifndef MyProjectDir
  #define MyProjectDir "."
#endif

#ifndef MySourceDir
  #define MySourceDir "release\win-unpacked"
#endif

#ifndef MyOutputDir
  #define MyOutputDir "release"
#endif

#define MyAppName "Axiom Engine"
#define MyAppPublisher "Axiom Engine"
#define MyAppURL "https://github.com/otaplus/axiom-engine"
#define MyAppExeName "Axiom Engine.exe"
#define MyAppId "{{D90DC6CC-D561-40C0-BC24-444DD1F665C7}"
#define MyVersionInfo MyAppVersion + ".0"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={localappdata}\Programs\Axiom Engine
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#MyOutputDir}
OutputBaseFilename=Axiom-Engine-{#MyAppVersion}-Setup
SetupIconFile={#MyProjectDir}\build\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
AllowNoIcons=yes
LicenseFile={#MyProjectDir}\LICENSE
VersionInfoVersion={#MyVersionInfo}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=Instalador de Axiom Engine
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#MyAppExeName}"; Flags: nowait postinstall; Check: WizardSilent()

[UninstallDelete]
Type: filesandordirs; Name: "{app}\resources\app.asar.unpacked"
