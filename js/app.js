app = angular.module('app', ['ionic', 'dataservices']);

app.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {

        $ionicConfigProvider.views.maxCache(0);
        
        $stateProvider.state('start', {
                url: "/start",
                templateUrl: "pages/start.html",
                controller: "Start"
        })
        
       
        $urlRouterProvider.otherwise("/start");
})