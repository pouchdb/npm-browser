'use strict';

//var COUCH_URL = 'https://skimdb.iriscouch.com/registry';
var COUCHDB_URL = 'http://localhost:5984/skimdb';

function PouchService () {
  var self = this;

  self.localPouch = new PouchDB('npm', {size: 3000});
  self.remotePouch = new PouchDB(COUCHDB_URL);
  self.couchdbUrl = COUCHDB_URL;

  self.localPouch.replicate.from(self.remotePouch)
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

angular.module('browserNpmApp').service('pouchService', PouchService);