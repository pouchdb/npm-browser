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

  function onGetDoc(module) {
    var latestName = module['dist-tags'].latest;
    var latest = module.versions[latestName];
    var lastPublishedBy = latest._npmUser;

    $scope.latestName = latestName;
    $scope.lastPublishedBy = lastPublishedBy;
    $scope.lastPublishedTimeRelative = moment(module.time[latestName]).fromNow();
    $scope.renderedMarkdown = $sce.trustAsHtml(markdown.toHTML(module.readme));
  }

  $scope.getGravatarUrl = function (maintainer) {
    if (!maintainer) {
      return '';
    }
    var md5sum = md5(maintainer.email);
    var url = 'https://secure.gravatar.com/avatar/' + md5sum + '?s=496&d=retro';
    return url;
  }
});