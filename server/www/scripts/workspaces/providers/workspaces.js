// Faraday Penetration Test IDE
// Copyright (C) 2013  Infobyte LLC (http://www.infobytesec.com/)
// See the file 'doc/LICENSE' for the license information

angular.module('faradayApp')
    .factory('workspacesFact', ['BASEURL', '$http', '$q', function(BASEURL, $http, $q) {
        var workspacesFact = {};

        workspacesFact.list = function() {
            var url = BASEURL + "_api/ws",
            deferred = $q.defer();
            $http.get(url).
                then(function(response) { deferred.resolve(response.data.workspaces) }, errorHandler);
            return deferred.promise;
        };

        returnStatus = function(data) {
            return $q.when(data.status);
        };

        workspacesFact.get = function(workspace_name) {
            var deferred = $q.defer();
            $http.get(BASEURL + workspace_name + '/' + workspace_name)
                .success(function(data, status, headers, config) {
                    deferred.resolve(data);
                })
                .error(function() {
                    deferred.reject();
                });
            return deferred.promise;
        };

        workspacesFact.getDuration = function(workspace_name) {
            var deferred = $q.defer();
            workspacesFact.get(workspace_name).then(function(workspace) {
                var ws = workspace;
                var dur = {};

                if(ws.hasOwnProperty('duration')) {
                    if(ws.duration.hasOwnProperty('start') && ws.duration.hasOwnProperty('end')) {
                        dur.start = ws.duration.start;
                        dur.end = ws.duration.end;
                    }
                } else if(ws.hasOwnProperty('sdate') && ws.hasOwnProperty('fdate')) {
                    dur.start = ws.sdate;
                    dur.end = ws.fdate;
                }
                deferred.resolve(dur);
            });
            return deferred.promise;
        };

        workspacesFact.exists = function(workspace_name) {
            var deferred = $q.defer();
            var request = {
                method: 'HEAD',
                url: BASEURL + workspace_name
            };
            $http(request).success(function(data) {
                deferred.resolve(true);
            })
            .error(function() {
                deferred.resolve(false);
            });
            return deferred.promise;
        };

        errorHandler = function(response) {
            if(typeof(response) == "object")
                return $q.reject(response.data.reason.replace("file", "workspace"));
            else if(typeof(response) == "string")
                return $q.reject(response);
            else
                return $q.reject("Something bad happened");
        };

        workspacesFact.put = function(workspace) {
            return createDatabase(workspace).
                then(function(resp) { createWorkspaceDoc(resp, workspace); }, errorHandler).
                then(function(resp) { uploadDocs(workspace.name); }, errorHandler);
        };

        createDatabase = function(workspace){
            return $http.put(BASEURL + workspace.name, workspace);
        };

        createWorkspaceDoc = function(response, workspace){
            $http.put(BASEURL + workspace.name + '/' + workspace.name, workspace).
                success(function(data){ 
                    workspace._rev = data.rev;
                }).
                error(function(data) {
                    errorHandler;
                });
        };

        uploadDocs = function(workspace) {
            var files = {},
            reports = BASEURL + 'reports/_design/reports';
            $http.get(reports).
                success(function(data) {
                    var attachments = data._attachments;
                    if(Object.keys(attachments).length > 0) {
                        for(var prop in attachments) {
                            if(attachments.hasOwnProperty(prop)) {
                                if(prop.indexOf("views/") > -1) {
                                    files[prop] = $http.get(reports + "/" + prop);
                                }
                            }
                        }
                    }
                    $q.all(files).then(function(resp) {
                        var bulk = {docs:[]};
                        for(var file in files) {
                            if(files.hasOwnProperty(file)) {
                                var views = [],
                                parts = file.split("/"), 
                                component = parts[1], 
                                type = parts[2],
                                name = parts[3], 
                                filename = parts[4].split(".")[0],
                                docIndex = indexOfDocument(bulk.docs, "_design/"+component);

                                if(docIndex == -1) {
                                    bulk.docs.push({
                                        _id: "_design/"+component,
                                        language: "javascript",
                                        views: {}
                                    });
                                    docIndex = bulk.docs.length - 1;
                                }

                                if(!bulk["docs"][docIndex]["views"].hasOwnProperty(name)) {
                                    bulk["docs"][docIndex]["views"][name] = {};
                                }

                                bulk["docs"][docIndex]["views"][name][filename] = resp[file]["data"];
                            }
                        }
                        $http.post(BASEURL + workspace + "/_bulk_docs", JSON.stringify(bulk));
                    }, errorHandler);
                }).
                error(function(data) {
                    errorHandler;
                });
        };

        indexOfDocument = function(list, name) {
            var ret = -1;
            list.forEach(function(item, index) {
                if(item._id == name) {
                    ret = index;
                }
            });
            return ret;
        };

        workspacesFact.update = function(workspace) {
            var deferred = $q.defer();
            document_url = BASEURL + workspace.name + '/' + workspace.name + '?rev=' + workspace._rev;
            $http.put(document_url, workspace).success(function(data){
                workspace._rev = data.rev;
                deferred.resolve(workspace);
            });
            return deferred.promise;
        };

        workspacesFact.delete = function(workspace_name) {
            var deferred = $q.defer();
            var request = {
                method: 'DELETE',
                url: BASEURL + workspace_name
            };
            $http(request).success(function(data) {
                deferred.resolve(workspace_name);
            })
            .error(function() {
                deferred.reject();
            });
            return deferred.promise;
        };
        return workspacesFact;
    }]);
