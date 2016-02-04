'use strict';

var COUCHDB_URL = 'https://nolan.cloudant.com/skimdb-mirror';
var INIT_REPL_BASE_URL = 'https://nolanlawson.s3.amazonaws.com/npm-browser-v2';

var NUM_DUMP_FILES = 327;

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
  // Sadly, iOS is limited to 50
  var size = /iP(hone|ad|od)/.test(navigator.userAgent) ? 50 : 2500;
  self.localPouch = new PouchDB('npm', {adapter: 'websql', size: size});
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
    var localDocId = '_local/initial_repl_done';
    // putIfNotExists provided by the pouchdb-upsert plugin
    return self.localPouch.putIfNotExists(localDocId, {
      filesLoaded: -1
    }).then(function () {
      return self.localPouch.get(localDocId)
    }).then(function (localDoc) {
      var filesLoaded = localDoc.filesLoaded;
      if (filesLoaded === NUM_DUMP_FILES - 1) {
        return; // done
      }
      // do initial replication
      var series = PouchDB.utils.Promise.resolve();
      function loadFile(num) {
        var file = getDumpFilenameForNumber(num);

        series = series.then(function () {
          return self.localPouch.load(file, {proxy: COUCHDB_URL}).then(function () {
            handleSuccess();
            // provided by the pouchdb-upsert plugin
            return self.localPouch.upsert(localDocId, function () {
              return {filesLoaded: num};
            });
          });
        });
      }
      for (var i = filesLoaded + 1; i < NUM_DUMP_FILES; i++) {
        loadFile(i);
      }
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
