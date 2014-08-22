'use strict';

var COUCHDB_URL = 'http://skimdb.iriscouch.com/registry';
//var COUCHDB_URL = 'http://localhost:5984/skimdb';

function PouchService (utils) {
  var self = this;

  self.localPouch = new PouchDB('npm', {size: 2000});

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

  self.remotePouch = new PouchDB(COUCHDB_URL);
  self.couchdbUrl = COUCHDB_URL;
  self.disconnected = false;

  // keep retrying replication if we go offline
  var STARTING_RETRY_TIMEOUT = 1000;
  var BACKOFF = 1.1;
  var retryTimeout = STARTING_RETRY_TIMEOUT;
  var inProgress = false;

  function replicate() {
    if (inProgress) {
      return;
    }
    inProgress = true;
    self.localPouch.replicate.from(self.remotePouch, {batch_size: 500})
      .on('change', function () {
        retryTimeout = STARTING_RETRY_TIMEOUT;
        self.disconnected = false;
        if (self.onChangeListener) {
          self.onChangeListener();
        }
      })
      .on('complete', function () {
        retryTimeout = STARTING_RETRY_TIMEOUT;
        self.disconnected = false;
        self.syncComplete = true;
        if (self.onCompleteListener) {
          self.onCompleteListener();
        }
      })
      .on('error', function (err) {
        console.log('error during replication');
        if (err) {
          console.log(err);
        }
        self.disconnected = true;
        if (self.onErrorListener) {
          self.onErrorListener();
        }
        if (inProgress) {
          retryTimeout = Math.floor(retryTimeout * BACKOFF); // exponential backoff
        }
        inProgress = false;
        setTimeout(replicate, retryTimeout);
      }
    );
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
