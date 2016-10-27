#!/usr/bin/env node

const _ = require('underscore');
const fs = require('fs');
const execFile = require('child_process').execFile;
const request = require('request');
const webdriverio = require('webdriverio');
const fhcInit = require('./lib/fhc-init');
const fhcCreateProject = require('./lib/fhc-create-project');
const fhcDeleteProject = require('./lib/fhc-delete-project');

const testAppFolder = __dirname + '/test_app/';
const projectName = 'api-test-project';

const config = require('./config/rhmap');
const cordovaUrl = 'http://localhost:8000/browser/www/index.html';

var project;
var cordova;
var success;

fhcInit(config)
  .then(forwardProjectDetails)
  .then(fhcCreateProject)
  .then(saveProject)
  .then(setFhconfig)
  .then(setTestConfig)
  .then(runCordova)
  .then(checkResults)
  .then(stopCordova)
  .then(forwardProjectGuid)
  .then(fhcDeleteProject)
  .then(() => {
    if (success) {
      console.log('TEST SUCCESS');
    } else {
      console.log('TEST FAILURE');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err);
  });

function runCordova() {
  return new Promise(function(resolve, reject) {
    cordova = execFile('cordova', ['serve'], { cwd: testAppFolder });
    resolve();
  });
}

function stopCordova() {
  cordova.kill('SIGINT');
}

function checkResults() {
  return httpRequest(cordovaUrl)
    .then(getResults)
    .catch((error) => { return checkResults(); });

  function getResults() {
    var options = {
      desiredCapabilities: {
        browserName: 'chrome'
      }
    };
    return new Promise(function(resolve, reject) {
      webdriverio
        .remote(options)
        .init()
        .url(cordovaUrl)
        .waitForVisible('#test-finished', 20000)
        .waitForText('#test-finished')
        .getText('body')
        .then((text) => {
          console.log(text);
          var lines = text.split('\n');
          success = true;
          lines.forEach((line) => {
            if (line.endsWith('ERROR')) {
              success = false;
            }
          });
        })
        .end()
        .call(() => {
          resolve(success);
        });
    });
  }
}

function forwardProjectDetails() {
  return {
    name: projectName,
    template: 'hello_world_project'
  };
}

function setFhconfig() {
  var app = _.find(project.apps, (app) => {
    return app.type === 'client_advanced_hybrid';
  });
  var fhConf = {
    appid: app.guid,
    appkey: app.apiKey,
    apptitle: app.title,
    connectiontag: '0.0.1',
    host: config.host,
    projectid: project.guid,
  }
  return new Promise(function(resolve, reject) {
    fs.writeFile(testAppFolder + 'www/fhconfig.json', JSON.stringify(fhConf, null, 2), (err) => {
      if (err) {
        return reject(err);
      }

      resolve();
    });
  });
}

function setTestConfig() {
  var testConf = {
    username: config.username,
    password: config.password,
    policyId: config.policyId,
    clientToken: config.clientToken
  }
  return new Promise(function(resolve, reject) {
    fs.writeFile(testAppFolder + 'www/testconfig.json', JSON.stringify(testConf, null, 2), (err) => {
      if (err) {
        return reject(err);
      }

      resolve();
    });
  });
}

function forwardProjectGuid() {
  return { guid: project.guid };
}

function saveProject(projectDetails) {
  project = projectDetails;
}

function httpRequest(url) {
  return new Promise(function(resolve, reject) {
    request(url, function (error, response, body) {
      if (error) {
        return reject(error);
      }
      resolve(body);
    });
  });
}
