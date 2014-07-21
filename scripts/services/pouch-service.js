'use strict';

var COUCHDB_URL = 'https://skimdb.iriscouch.com/registry';
//var COUCHDB_URL = 'http://localhost:5984/skimdb';

function PouchService (utils) {
  var self = this;

  self.localPouch = new PouchDB('npm', {size: 3000, adapter: 'websql'});
  if (!self.localPouch.adapter) {
    self.localPouch = new PouchDB('npm'); // fall back to IndexedDB
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

  self.remotePouch = new PouchDB(COUCHDB_URL);
  self.couchdbUrl = COUCHDB_URL;

  self.localPouch.replicate.from(self.remotePouch, {batch_size: 500})
    .on('change', function () {
      if (self.onChangeListener) {
        self.onChangeListener();
      }
    })
    .on('complete', function () {
      self.syncComplete = true;
    }
  );
}

PouchService.prototype.onChange = function (onChangeListener) {
  this.onChangeListener = onChangeListener;
};

PouchService.prototype.getShortCouchUrl = function () {
  return this.couchdbUrl.replace(/^https?:\/\//,'');
};

angular.module('browserNpmApp').service('pouchService', PouchService);