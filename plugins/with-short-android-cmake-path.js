const { withAppBuildGradle } = require('@expo/config-plugins');

const DEFINITION_MARKER = '// @generated donatdankau short CMake path definition';
const CONFIG_MARKER = '// @generated donatdankau short CMake path config';
const NODE_ENV_MARKER = '// @generated donatdankau Gradle NODE_ENV fallback';
const JOB_POOL_MARKER = '// @generated donatdankau limited CMake job pool';
const ABI_SPLITS_MARKER = '// @generated donatdankau ABI splits';

function addShortCmakePath(buildGradle) {
  let contents = buildGradle;

  if (
    !contents.includes(DEFINITION_MARKER) &&
    !contents.includes('def nativeBuildStagingDir = new File(')
  ) {
    const projectRootDefinition = /def projectRoot = .*\r?\n/;

    if (!projectRootDefinition.test(contents)) {
      throw new Error('Could not find projectRoot in android/app/build.gradle');
    }

    contents = contents.replace(
      projectRootDefinition,
      (match) =>
        `${match}${DEFINITION_MARKER}\n` +
        'def nativeBuildStagingDir = new File(\n' +
        '    System.getProperty("user.home"),\n' +
        '    ".gradle/cxx/donatdankau-pos-${Integer.toHexString(projectRoot.hashCode())}"\n' +
        ')\n'
    );
  }

  if (
    !contents.includes(CONFIG_MARKER) &&
    !contents.includes('buildStagingDirectory nativeBuildStagingDir')
  ) {
    const androidBlock = /android\s*\{\r?\n/;

    if (!androidBlock.test(contents)) {
      throw new Error('Could not find the android block in android/app/build.gradle');
    }

    contents = contents.replace(
      androidBlock,
      (match) =>
        `${match}    ${CONFIG_MARKER}\n` +
        '    externalNativeBuild {\n' +
        '        cmake {\n' +
        '            // Keep generated Ninja paths short enough for Windows builds.\n' +
        '            buildStagingDirectory nativeBuildStagingDir\n' +
        '        }\n' +
        '    }\n'
    );
  }

  if (
    !contents.includes(ABI_SPLITS_MARKER) &&
    !contents.includes('include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"')
  ) {
    const androidBlock = /android\s*\{\r?\n/;

    if (!androidBlock.test(contents)) {
      throw new Error('Could not find the android block in android/app/build.gradle');
    }

    contents = contents.replace(
      androidBlock,
      (match) =>
        `${match}    ${ABI_SPLITS_MARKER}\n` +
        '    splits {\n' +
        '        abi {\n' +
        '            enable true\n' +
        '            reset()\n' +
        '            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"\n' +
        '            universalApk false\n' +
        '        }\n' +
        '    }\n'
    );
  }

  if (
    !contents.includes(NODE_ENV_MARKER) &&
    !contents.includes('def requestedGradleTasks = gradle.startParameter.taskNames')
  ) {
    const reactBlock = /react\s*\{\r?\n/;

    if (!reactBlock.test(contents)) {
      throw new Error('Could not find the react block in android/app/build.gradle');
    }

    const nodeEnvFallback =
      `${NODE_ENV_MARKER}\n` +
      'gradle.projectsEvaluated {\n' +
      '    if (System.getenv("NODE_ENV") == null) {\n' +
      '        def requestedGradleTasks = gradle.startParameter.taskNames*.toLowerCase()\n' +
      '        def isReleaseBuild = requestedGradleTasks.any { taskName ->\n' +
      '            taskName.contains("release") || taskName.contains("relwithdebinfo")\n' +
      '        }\n' +
      '\n' +
      '        rootProject.findProject(":expo-constants")?.tasks\n' +
      '            ?.matching { task -> task.name == "createExpoConfig" }\n' +
      '            ?.configureEach { task ->\n' +
      '                task.environment "NODE_ENV", isReleaseBuild ? "production" : "development"\n' +
      '            }\n' +
      '    }\n' +
      '}\n\n';

    contents = contents.replace(reactBlock, (match) => `${nodeEnvFallback}${match}`);
  }

  if (
    !contents.includes(JOB_POOL_MARKER) &&
    !contents.includes('-DCMAKE_JOB_POOLS=donatdankau_native_jobs=2')
  ) {
    const defaultConfigBlock = /defaultConfig\s*\{\r?\n/;

    if (!defaultConfigBlock.test(contents)) {
      throw new Error('Could not find defaultConfig in android/app/build.gradle');
    }

    contents = contents.replace(
      defaultConfigBlock,
      (match) =>
        `${match}        ${JOB_POOL_MARKER}\n` +
        '        externalNativeBuild {\n' +
        '            cmake {\n' +
        '                arguments "-DCMAKE_JOB_POOLS=donatdankau_native_jobs=2",\n' +
        '                    "-DCMAKE_JOB_POOL_COMPILE=donatdankau_native_jobs",\n' +
        '                    "-DCMAKE_JOB_POOL_LINK=donatdankau_native_jobs"\n' +
        '            }\n' +
        '        }\n'
    );
  }

  return contents;
}

module.exports = function withShortAndroidCmakePath(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('with-short-android-cmake-path only supports Groovy build.gradle files');
    }

    modConfig.modResults.contents = addShortCmakePath(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.addShortCmakePath = addShortCmakePath;
