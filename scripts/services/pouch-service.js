'use strict';

var COUCHDB_URL = 'http://skimdb.iriscouch.com/registry';
var INIT_REPL_BASE_URL = 'https://nolanlawson.s3.amazonaws.com/npm-browser-v3';

var NUM_DUMP_FILES = 164;

function getDumpFilenameForNumber(i) {
  var numStr = i.toString();
  while (numStr.length < 8) {
    numStr = '0' + numStr;
  }
  return INIT_REPL_BASE_URL + '/npm_' + numStr + '.txt';
}

function PouchService (utils, $rootScope) {
  var self = this;

  // on Safari, we need to make a big ask up-front for 3GB
  self.localPouch = new PouchDB('npm', {adapter: 'websql', size: 2500});
  if (!self.localPouch.adapter) {
    self.localPouch = new PouchDB('npm');
  }

  self.localPouch.transform({
    incoming: function (doc) {
      // filter fields we don't need to change
      doc = utils.pick(doc, [
        '_id', '_rev', '_revisions', 'name', 'description',
        'dist-tags', 'versions',
        'readme', 'maintainers', 'time'
      ]);
      // filter fields we don't need for the app
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
    var localDocId = '_local/initial_load_done-v3';
    // putIfNotExists provided by the pouchdb-upsert plugin
    return self.localPouch.putIfNotExists(localDocId, {
      filesLoaded: -1
    }).then(function () {
      return self.localPouch.get(localDocId)
    }).then(function (localDoc) {

      function loadFile(num) {
        // load them in reverse order, because the most interesting
        // modules were updated most recently
        var file = getDumpFilenameForNumber(NUM_DUMP_FILES - num - 1);

        return function () {
          return self.localPouch.load(file, {proxy: COUCHDB_URL}).then(function () {
            handleSuccess();
            return self.localPouch.upsert(localDocId, function () {
              return {filesLoaded: num};
            });
          });
        };
      }

      // also load the final file again, just to get the right update_seq
      function loadFinalFile() {
        var finalFile = getDumpFilenameForNumber(NUM_DUMP_FILES - 1);

        return self.localPouch.load(finalFile, {proxy: COUCHDB_URL}).then(function () {
          handleSuccess();
          return self.localPouch.upsert(localDocId, function (doc) {
            doc.loadedFinalFile = true;
            return doc;
          });
        });
      }

      // do initial replication if necessary
      var promise = PouchDB.utils.Promise.resolve();
      for (var i = localDoc.filesLoaded + 1; i < NUM_DUMP_FILES; i++) {
        promise = promise.then(loadFile(i));
      }
      return promise.then(function () {
        if (!localDoc.loadedFinalFile) {
          return loadFinalFile();
        }
      });
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
