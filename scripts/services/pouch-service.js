'use strict';

var COUCHDB_URL = 'http://skimdb.iriscouch.com/registry';
//var COUCHDB_URL = 'http://localhost:5984/skimdb';
var INIT_REPL_BASE_URL = 'https://nolanlawson.s3.amazonaws.com/npm-browser';
//var INIT_REPL_BASE_URL = '/www';

var NUM_DUMP_FILES = 222;

function getDumpFilenameForNumber(i) {
  var numStr = i.toString();
  while (numStr.length < 8) {
    numStr = '0' + numStr;
  }
  return INIT_REPL_BASE_URL + '/npm_' + numStr + '.txt';
}

function PouchService (utils, $rootScope) {
  var self = this;

  // fall back from websql to indexedb for performance
  self.localPouch = new PouchDB('npm', {adapter: 'websql', size: 2000});
  if (!self.localPouch.adapter) {
    self.localPouch = new PouchDB('npm');
  }

  self.localPouch.filter({
    incoming: function (doc) {
      // filter fields we don't need

      doc = utils.pick(doc, [
        '_id', '_rev', 'name', 'description', 'dist-tags', 'versions',
        'readme', 'maintainers', 'time'
      ]);
      if (doc['dist-tags'] && doc['dist-tags'].latest) {
        var latest = doc['dist-tags'].latest;
        if (doc.time) {
          doc.time = utils.pick(doc.time, [latest]);
        }
        if (doc.versions && doc.versions[latest]) {
          doc.versions = utils.pick(doc.versions, [latest]);
          doc.versions[latest] = utils.pick(doc.versions[latest],
            [
              'name', 'version', 'description', 'author', 'homepage', 'repository', 'keywords',
              'maintainers', 'bugs', '_npmUser', 'maintainers', 'readme'
            ]
          );
        }
      }
      return doc;
    }
  });

  self.localPouch.changes({live: true, since: 'now'}).on('change', function () {
    if (self.onChangeListener) {
      self.onChangeListener();
    }
  });

  self.remotePouch = new PouchDB(COUCHDB_URL);
  self.couchdbUrl = COUCHDB_URL;
  self.disconnected = false;

  // keep retrying replication if we go offline
  var STARTING_RETRY_TIMEOUT = 1000;
  var BACKOFF = 1.1;
  var retryTimeout = STARTING_RETRY_TIMEOUT;
  var inProgress = false;

  // quick replication via the pouchdb-dump plugin
  // downloads a bunch of dump files from Amazon S3
  function doInitialReplication() {
    var localDocId = '_local/init_repl_done';
    return self.localPouch.get(localDocId).catch(function (err) {
      if (err.status !== 404) {
        throw err;
      }
      var localDoc = {_id: localDocId, filesLoaded: -1};
      return self.localPouch.put(localDoc).then(function () {
        return self.localPouch.get(localDocId);
      });
    }).then(function (localDoc) {
      var filesLoaded = localDoc.filesLoaded;
      if (filesLoaded === NUM_DUMP_FILES) {
        return; // done
      }
      // do initial replication
      var dumpFiles = [];
      for (var i = filesLoaded + 1; i <= NUM_DUMP_FILES; i++) {
        dumpFiles.push(i);
      }
      var series = PouchDB.utils.Promise.resolve();
      dumpFiles.forEach(function (i) {
        var file = getDumpFilenameForNumber(i);

        series = series.then(function () {
          return self.localPouch.load(file, {proxy: COUCHDB_URL}).then(function () {
            handleSuccess();
            return self.localPouch.get(localDocId);
          }).then(function (localDoc) {
            localDoc.filesLoaded = i;
            return self.localPouch.put(localDoc);
          });
        });
      });
      return series;
    });
  }

  // regular replication, replicates from a CORSful skimdb mirror
  // that Nolan is hosting on iriscouch
  function doRegularReplication() {
    self.localPouch.replicate.from(self.remotePouch, {batch_size: 500})
      .on('change', handleSuccess)
      .on('complete', handleComplete)
      .on('error', handleError);
  }

  function handleError(err) {
    console.log('error during replication');
    if (err) {
      console.log(err);
    }
    self.disconnected = true;
    if (inProgress) {
      retryTimeout = Math.floor(retryTimeout * BACKOFF); // exponential backoff
    }
    inProgress = false;
    setTimeout(replicate, retryTimeout);
    $rootScope.$apply();
  }

  function handleSuccess() {
    retryTimeout = STARTING_RETRY_TIMEOUT;
    self.disconnected = false;
    $rootScope.$apply();
  }

  function handleComplete() {
    handleSuccess();
    self.syncComplete = true;
    $rootScope.$apply();
  }

  function replicate() {
    if (inProgress) {
      return;
    }
    inProgress = true;

    doInitialReplication().then(function () {
      doRegularReplication();
    }).catch(handleError);
  }
  replicate();
}

PouchService.prototype.onChange = function (onChangeListener) {
  this.onChangeListener = onChangeListener;
};

PouchService.prototype.onComplete = function (onCompleteListener) {
  this.onCompleteListener = onCompleteListener;
};

PouchService.prototype.onError = function (onErrorListener) {
  this.onErrorListener = onErrorListener;
};

PouchService.prototype.getShortCouchUrl = function () {
  return this.couchdbUrl.replace(/^https?:\/\//,'');
};

angular.module('browserNpmApp').service('pouchService', PouchService);
