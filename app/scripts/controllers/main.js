'use strict';

angular.module('browserNpmApp')
  .controller('MainCtrl', function ($scope) {

    $scope.couchdbUrl = 'http://nolan.iriscouch.com/skimdb/';
    $scope.docCount = 0;
    $scope.remoteDocCount = 0;

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

    fetchRemoteDocCount();

    pouch.replicate.from(remotePouch, {
      onChange: fetchDocCount,
      complete: function () {
        $scope.syncComplete = true;
      }
    });
  });
