angular.module('browserNpmApp').controller('DetailCtrl',
    function ($rootScope, $scope, $routeParams, $sce, pouchService) {

  var localPouch = pouchService.localPouch;
  var remotePouch = pouchService.remotePouch;
  var moduleId = $routeParams.moduleId;

  localPouch.get(moduleId)['catch'](function (err) {
    if (err.name !== 'not_found') {
      throw err;
    }
    return remotePouch.get(moduleId);
  }).then(function (doc) {
    $scope.module = doc;
    onGetDoc(doc);
    $rootScope.$apply();
  })['catch'](function (err) {
    console.log(err);
  });

  function onGetDoc(doc) {
    var latestName = doc['dist-tags'].latest;
    var latest = doc.versions[latestName];
    var time = doc.time[latestName];
    var lastPublishedTimeRelative = time ? moment(time).fromNow() : '(unknown)';
    var lastPublishedBy = latest._npmUser || latest.author || latest.maintainers[0];

    $scope.latest = latest;
    $scope.latestName = latestName;
    $scope.lastPublishedBy = lastPublishedBy;
    $scope.lastPublishedTimeRelative = lastPublishedTimeRelative;
    $scope.renderedMarkdown = $sce.trustAsHtml(markdown.toHTML(doc.readme || ''));
  }

  $scope.getGravatarUrl = function (maintainer) {
    if (!maintainer || !maintainer.email) {
      return '';
    }
    var md5sum = md5(maintainer.email);
    var url = 'https://secure.gravatar.com/avatar/' + md5sum + '?s=496&d=retro';
    return url;
  }
});