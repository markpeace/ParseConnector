app.service('Models', function(ParseConnector, $q) {

        var model = ParseConnector.initialise({
                app_id: "edND7HJo79GX6cn3r6hiArH5w6eioly1WPddottY",
                javascript_key: "Tgozw1FvRVn8gGDKugHTXY6CRlwtDzfFH1Yet56I"
        })

        definitions = {
                book: {
                        table: 'Book',
                        parse_update_delay: 0,
                        attributes: {
                                title: { required: true, unique: true },
                                type: {}
                        }

                },
                pc_system: {
                        table: 'pc_system'
                }
        }


        tests = [
                { 
                        title:"Any existing data should be removed",
                        doTest: function() {
                                var deferred = $q.defer()

                                var promises = []

                                for(key in definitions) {

                                        window.localStorage.removeItem(definitions[key].table)
                                        var search_promise = $q.defer();                                         

                                        (new Parse.Query(definitions[key].table))
                                                .find().then(function(records) {
                                                Parse.Object.destroyAll(records).then(function() { deferred.resolve() })
                                        } )                  

                                }

                                model={}

                                return  deferred.promise
                        } 
                },
                { 
                        title: "the 'new Model' call should create a model",
                        doTest: function() {
                                var deferred = $q.defer()

                                model.book = new ParseConnector.Model(definitions.book)

                                $q.all(model.book.update_promise).then(function() {
                                        if(model.book.table == definitions.book.table) {
                                                deferred.resolve()                                                                       
                                        } else {
                                                deferred.reject("Expected to find model.book, but it wasn't there")
                                        }
                                })


                                return  deferred.promise
                        } 
                },
                { 
                        title: "model.new({field_list:content}).save() should create a new record",
                        doTest: function() {
                                var deferred = $q.defer()

                                model.book.new({ title:'Book One', type:"Paperback"}).save().then(function() {

                                        var query = new Parse.Query(model.book.table)
                                        query.find().then(function(records) {
                                                if(records.length==1) {
                                                        if(model.book.data.length===1) {
                                                                var datastore_length = JSON.parse(window.localStorage.getItem(model.book.table)).data.length
                                                                if(datastore_length===1) {

                                                                        //double check it's still ok after a recache
                                                                        model.book.recache().then(function() {

                                                                                if(model.book.data.length==1) {
                                                                                        deferred.resolve()        
                                                                                } else {
                                                                                        deferred.reject("expected to find 1 record in local datastore after recache, but found "+model.book.data.length)
                                                                                }

                                                                        })

                                                                } else {
                                                                        deferred.reject("expected to find 1 record in localStorage, but found "+datastore_length)
                                                                }


                                                        } else {
                                                                deferred.reject("expected to find 1 record in local datastore, but found "+model.book.data.length)
                                                        }
                                                } else {
                                                        deferred.reject("expected to find 1 record in parse, but found "+records.length)
                                                }
                                        })


                                }, function(e) {
                                        deferred.reject("Error creating a record: " + e.message)       
                                })                                                                

                                return  deferred.promise
                        } 
                },
                { 
                        title: "records created somewhere else should enter the localcache",
                        doTest: function() {
                                var deferred = $q.defer()

                                var prepopulate = function() {
                                        (new (Parse.Object.extend(model.book.table))).save({title: "Book Two", type: "Paperback"}).then(function() { doTest() })
                                }

                                var doTest=function() {

                                        if(model.book.data.length!=1) { deferred.reject("was expecting 1 record before test, but found " + model.book.data.length); return; }

                                        model.book.recache().then(function() {

                                                if(model.book.data.length==2) {
                                                        deferred.resolve()                                                                                                        
                                                } else {
                                                        deferred.reject("was expecting 2 records, but found "+model.book.data.length)
                                                }
                                        })                                       

                                }

                                prepopulate();

                                return deferred.promise
                        } 
                },  
                { 
                        title: "if a *required field* isn't provided, records should not save",
                        doTest: function() {
                                var deferred = $q.defer()

                                model.book.new().save().then(function() {
                                        deferred.reject("should have rejected a record without a title, but it was saved")        
                                }, function() {
                                        deferred.resolve() 
                                })

                                return  deferred.promise
                        } 
                },  
                { 
                        title: "if a *unique field* isn't provided, records should not save",
                        doTest: function() {
                                var deferred = $q.defer()

                                model.book.new({title:"Book One"}).save().then(function() {
                                        deferred.reject("should have rejected a record with a duplicated title, but it was saved")        
                                }, function() {
                                        deferred.resolve() 
                                })

                                return  deferred.promise
                        } 
                },  
                { 
                        title: "model.filterBy should return an array of objects with matching properties",
                        doTest: function() {
                                var deferred = $q.defer()

                                var prepopulate = function (){

                                        var promises = []
                                        var titles = ["Book Three", "Book Four", "Book Five", "Book Six"]
                                        titles.forEach(function(title){
                                                promises.push(  model.book.new({title:title, type:"Hardback" }).save()  )
                                        })

                                        $q.all(promises).then(doTest)

                                }

                                doTest = function() {

                                        if(model.book.data.length!=6) { deferred.reject("was expecting 6 records before test, but found " + model.book.data.length); return; }

                                        found_records = model.book.filterBy({type:"Hardback"})

                                        if(found_records.length===4) {
                                                deferred.resolve()                                                                               
                                        } else {
                                                deferred.reject("was expecting to find 4 records, but found "+found_records.length)
                                        }


                                }

                                prepopulate()                               

                                return  deferred.promise
                        } 
                }, 
                { 
                        title: "record.save() should update the record",
                        doTest: function() {
                                var deferred = $q.defer()

                                updateRecord = model.book.filterBy({title: "Book Six"})[0]
                                updateRecord.title="xxx"
                                updateRecord.save().then(function() {

                                        (new Parse.Query(model.book.table))
                                                .get(updateRecord.title).then(function(record) {

                                                if(record.get("title")==updateRecord.title) {
                                                        deferred.resolve()
                                                } else {
                                                        deferred.reject("expected title of parse record to be '"+updateRecord.title+"' but it was '"+record.get("title")+"'")
                                                }

                                        } ) 

                                })


                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },
                { 
                        title: "records updated somewhere else should enter the localcache",
                        doTest: function() {
                                var deferred = $q.defer()

                                updateRecord = model.book.filterBy({title: "xxx"})[0]

                                if(updateRecord.title!="xxx") { deferred.reject("expected existing field to be 'xxx', but it was '"+updateRecord.title+"'") }

                                var query = new Parse.Query(model.book.table)
                                query.get(updateRecord.id).then(function(record) {
                                        record.set('title',"delete_me")
                                        record.save().then(function () {

                                                model.book.recache().then(function() {
                                                        updateRecord = model.book.filterBy({title: "delete_me"})

                                                        if(updateRecord.length===1) {
                                                                deferred.resolve()                                                                                        
                                                        } else {
                                                                deferred.reject("expected a record with the title 'delete_me', but there wasn't one");
                                                        }


                                                })

                                        })
                                } ) 

                                return  deferred.promise
                        } 
                },  

                { 
                        title: "record.delete() should delete the record",
                        doTest: function() {
                                var deferred = $q.defer()

                                var deleteRecord = model.book.filterBy({title: "delete_me"})[0]                                
                                var recordCount = model.book.data.length-1

                                deleteRecord.delete().then(function() {

                                        if(model.book.data.length==recordCount) {

                                                var records_in_storage = JSON.parse( window.localStorage.getItem(model.book.table) ).data.length

                                                if( records_in_storage == recordCount ) {

                                                        var query = new Parse.Query(model.book.table)
                                                        query.get(deleteRecord.id).then(function(record) {                                                                
                                                                deferred.reject("should not have found deleted record, but did")                                                                
                                                        }, function() {
                                                                deferred.resolve()
                                                        })

                                                } else {
                                                        deferred.reject("expected localStorage to have "+recordCount+ " records but found "+records_in_storage)
                                                }

                                        } else {
                                                deferred.reject("expected local datastore to have "+ recordCount + " records but found "+model.book.data.length)
                                        }


                                })


                                return  deferred.promise
                        } 
                },                
                { 
                        title: "records deleted somewhere else should be removed from the localcache",
                        doTest: function() {
                                var deferred = $q.defer()

                                record_to_delete = model.book.filterBy({title:"Book Five"})[0]

                                var query = new Parse.Query(model.book.table)
                                query.get(record_to_delete.id).then(function(record) {                                                                

                                        record.destroy().then(function() {

                                                (new (Parse.Object.extend("pc_system"))).save({ action:'deleted', table: 'Book', target_id: record_to_delete.id }).then(function() { 

                                                        model.book.recache().then(function() {

                                                                record_to_delete = model.book.filterBy({title:"Book Five"})

                                                                if(record_to_delete.length==0) {
                                                                        deferred.resolve()                                                                                
                                                                } else {
                                                                        deferred.reject("shouldn't have been able to find deleted record in local, but could")
                                                                }

                                                        })                                                        

                                                })

                                        })

                                })



                                return  deferred.promise
                        } 
                },  
                { 
                        title: "Dummy Test",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },                

        ]         

        test_number=0
        execute_test = function (test_number) {

                var f = "font-weight: bold; text-decoration: underline;" + 
                    (tests[test_number].title.substring(0,3)=="###" ? "color:orange;" : "")

                console.debug("%cRUNNING TEST #"+test_number+": "+ tests[test_number].title, f)

                tests[test_number].doTest().then(function() {
                        console.debug("%c✔ Test Successful", "color:green;  ")
                        console.debug(" ")

                        if (tests.length-1>test_number) {
                                test_number++
                                execute_test(test_number)
                        } else {
                                console.debug("%cAll Tests Now Complete!", "font-weight: bold; text-decoration: underline;")                
                        }

                }, function (e) {
                        console.debug("%c✖ Test Failed: "+e, "color:red")

                })

        }
        execute_test(0)
        return

});