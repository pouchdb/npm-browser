'use strict';

angular.module('browserNpmApp')
  .controller('MainCtrl', function ($scope) {

    var PAGE_SIZE = 10;

    $scope.couchdbUrl = 'https://skimdb.npmjs.com/registry';
    //$scope.couchdbUrl = 'http://nolan.iriscouch.com/skimdb';
    $scope.docCount = 0;
    $scope.remoteDocCount = 0;
    $scope.page = [];
    $scope.pageStack = [];

    var dirty = false;
    var startkey;
    var pouch = new PouchDB('npm');
    var remotePouch = new PouchDB($scope.couchdbUrl);

    function fetchDocCount() {
      pouch.info().then(function (res) {
        $scope.docCount = res.doc_count;
        $scope.$apply();
      });
    }

    function fetchRemoteDocCount() {
      remotePouch.info().then(function (res) {
        $scope.remoteDocCount = res.doc_count;
        $scope.$apply();
      });
    }

    function updatePage() {
      fetchDocCount();

      if ($scope.loading) {
        dirty = true;
        return;
      }

      $scope.loading = true;
      var opts = {
        limit: PAGE_SIZE,
        include_docs: true
      };
      if (startkey) {
        opts.startkey = startkey;
        opts.skip = 1;
      }

      pouch.allDocs(opts).then(function (res) {
        $scope.page = res.rows.map(function (row) {
          row.doc.maintainersString = (row.doc.maintainers || []).map(function (person) {
            return person.name
          }).join(', ');
          return row.doc;
        });
        $scope.loading = false;
        if (dirty) {
          dirty = false;
          updatePage();
        }
        $scope.$apply();
      });
    }

    pouch.replicate.from(remotePouch)
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
  });
