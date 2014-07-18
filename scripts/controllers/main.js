'use strict';

function capitalize(str) {
  if (str.length < 2) {
    return str.toUpperCase();
  }
  return str.charAt(0).toUpperCase() + str.substring(1).toLowerCase();
}

angular.module('browserNpmApp')
  .controller('MainCtrl', function ($scope) {

    var PAGE_SIZE = 10;

    $scope.couchdbUrl = 'https://skimdb.iriscouch.com/registry';
    //$scope.couchdbUrl = 'http://localhost:5984/skimdb';
    $scope.docCount = 0;
    $scope.remoteDocCount = 0;
    $scope.page = [];
    $scope.pageStack = [];

    var dirty = false;
    var startkey;

    var localPouch = new PouchDB('npm', {size: 3000});
    var remotePouch = new PouchDB($scope.couchdbUrl);

    function fetchDocCount() {
      localPouch.info().then(function (res) {
        $scope.docCount = res.doc_count;
        $scope.$apply();
      });
    }

    function fetchRemoteDocCount() {
      remotePouch.info().then(function (res) {
        $scope.remoteDocCount = res.doc_count;
        localStorage['remote_size'] = res.doc_count;
        $scope.$apply();
      }, function (err) {
        console.log(err);
        // just use the last known
        $scope.remoteDocCount = localStorage['remote_size'] || 0;
        $scope.$apply();
      });
    }

    var timeout;
    var first = false;
    function updatePage() {
      // use a timeout so it doesn't happen multiple times at once
      if (first) {
        first = false;
        updatePageAfterTimeout();
        return;
      } else if (typeof timeout !== 'undefined') {
        clearTimeout(timeout);
      }
      timeout = setTimeout(function () {
        updatePageAfterTimeout();
      }, 50);
    }

    function updatePageAfterTimeout() {
      fetchDocCount();

      if ($scope.loading) {
        dirty = true;
        return;
      }

      $scope.loading = true;

      function done() {

        $scope.loading = false;
        if (dirty) {
          dirty = false;
          updatePage();
        }
        $scope.$apply();
      }

      getDocs().then(function (res) {
        $scope.page = res.rows.map(function (row) {
          return row.doc;
        });
        done();
      }, function (err) {
        console.log(err);
        done();
      });
    }

    function getDocs() {

      var inQuery = $scope.query && $scope.query.length >= 2;
      if (inQuery) {
        return getDocsViaQuery();
      } else {
        return getDocsNormally();
      }
    }

    function getDocsNormally() {
      var opts = {
        limit: PAGE_SIZE,
        include_docs: true
      };
      if (startkey) {
        opts.startkey = startkey;
        opts.skip = 1;
      }

      return localPouch.allDocs(opts);
    }

    function getDocsViaQuery() {

      var queryStart = startkey || $scope.query;
      var queryEnd = $scope.query;

      // packages don't have any particular case, so fudge it
      var lc = [queryStart.toLowerCase(), queryEnd.toLowerCase()];
      var uc = [queryStart.toUpperCase(), queryEnd.toUpperCase()];
      var cap = [capitalize(queryStart), capitalize(queryEnd)];

      // search locally and remote since we might not be synced at 100% yet
      var queryPermutations = [ lc, uc, cap ];


      // if we're done syncing, then we can safely just use local search for speed
      var pouches = $scope.syncComplete ? [localPouch] : [localPouch, remotePouch];

      return PouchDB.utils.Promise.all(pouches.map(function (pouch) {
        return PouchDB.utils.Promise.all(queryPermutations.map(function (query) {
          var opts = {
            startkey: query[0],
            endkey: query[1] + '\uffff',
            limit: PAGE_SIZE,
            include_docs: true
          };

          return pouch.allDocs(opts).then(null, function (err) {
            console.log(err);
            return {rows: []}; // works offline
          });
        }));
      })).then(function (resultLists) {
        var map = {};
        // combine results
        resultLists.forEach(function (resultList) {
          resultList.forEach(function (res) {
            res.rows.forEach(function (row) {
              if (row.doc.time && row.doc.time.unpublished) {
                return;
              } else if (row.id === startkey) { // paging, so remove
                return;
              }
              map[row.id] = row;
            });
          });
        });
        var keys = Object.keys(map);

        keys.sort(function (a, b) {
          // case insensitive sort
          a = a.toLowerCase();
          b = b.toLowerCase();
          return a < b ? -1 : a > b ? 1 : 0;
        });
        var rows = keys.map(function (key) {
          return map[key];
        });
        if (rows.length > PAGE_SIZE) {
          rows = rows.slice(0, PAGE_SIZE);
        }
        return {rows: rows};
      });
    }

    localPouch.replicate.from(remotePouch)
      .on('change', updatePage)
      .on('complete', function () {
        $scope.syncComplete = true;
      }
    );
    fetchRemoteDocCount();
    updatePage();

    $scope.nextPage = function() {
      var lastDoc = $scope.page[$scope.page.length - 1];
      if (lastDoc) {
        $scope.pageStack.push(startkey);
        startkey = lastDoc._id;
        updatePage();
      }
    }

    $scope.previousPage = function() {
      startkey = $scope.pageStack.pop();
      updatePage();
    }

    $scope.performSearch = function() {
      startkey = null; // reset
      $scope.pageStack = [];
      updatePage();
    }
  });
