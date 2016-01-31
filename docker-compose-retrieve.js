#!/usr/bin/env node

/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-01-31
 * @author Liang <liang@maichong.it>
 */

'use strict';

const execSync = require('child_process').execSync;
const yaml = require('js-yaml');
const _ = require('lodash');

let name = process.argv[2];

if ('--help' === name) {
  console.log('\n  USAGE: docker-compose-retrieve name\n\n');
  console.log('  options:\n');
  console.log('  --help                     Display this message and exit\n');
  process.exit(0);
}

if (!name) {
  console.log('please specify name');
  process.exit(1);
}

let res = execSync('docker ps -a', {
  encoding: 'utf-8'
});

let tasks = [];
let map = {};
let compose = {};

let reg = new RegExp(name + '_(\\w+)_1');

res.split('\n').forEach(line=> {
  let r = line.match(reg);
  if (r) {
    tasks.push(r[1]);
    map[r[1]] = {
      container: r[0]
    };
    compose[r[1]] = {};
  }
});

if (!tasks.length) {
  console.log('no container found');
  process.exit(0);
}

tasks.forEach(n=> {
  let container = map[n].container;
  let res = execSync('docker inspect ' + container, {
    encoding: 'utf-8'
  });

  let json = JSON.parse(res);
  let task = compose[n];
  task.image = json[0].Config.Image;

  _.forEach(_.get(json[0], 'HostConfig.PortBindings'), (arr, key)=> {
    _.forEach(arr, value=> {
      if (!task.ports) {
        task.ports = [];
      }
      task.ports.push((value.HostIp ? value.HostIp + ':' : '') + value.HostPort + ':' + key);
    });
  });
  if (_.get(json[0], 'HostConfig.RestartPolicy.Name') == 'always') {
    task.restart = 'always';
  }
  _.forEach(_.get(json[0], 'HostConfig.Binds'), (value)=> {
    if (!task.volumes) {
      task.volumes = [];
    }
    task.volumes.push(value);
  });
  _.forEach(_.get(json[0], 'Config.Env'), (value)=> {
    if (!task.environment) {
      task.environment = [];
    }
    task.environment.push(value);
  });
  _.forEach(_.get(json[0], 'HostConfig.Links'), (value)=> {
    if (value.endsWith('_1')) {
      return;
    }
    if (!task.links) {
      task.links = [];
    }
    let arr = value.split(':');

    let matchs = arr[0].match(reg);
    let serviceName = matchs[1];
    let serviceAlias = arr[1].substr(arr[1].lastIndexOf('/') + 1);
    task.links.push(serviceName + ':' + serviceAlias);
  });

  task.command = json[0].Config.Cmd.join(' ');

  //console.log(json);
  //process.exit(0);
});

let result = yaml.dump(compose).replace(/\/tcp/g, '').replace(/0\.0\.0\.0\:/g, '');
console.log(result);
