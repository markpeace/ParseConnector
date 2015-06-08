app.service('Models', function(ParseConnector, $q) {

        takeOverConsole = function(){
                var original = window.console       
                var native_functions = ["log", "info", "warn","debug","error"]

                var new_console = {
                        history: [],
                        clear_history: function() { window.console.history = [] }
                }
                native_functions.forEach(function(native_function) {
                        new_console[native_function] = function() {
                                console.history.push(native_function + " : " + arguments[0])
                                original[native_function].apply(original, arguments)
                        }
                })

                window.console = new_console                
        }()


        var model = ParseConnector.initialise({
                app_id: "edND7HJo79GX6cn3r6hiArH5w6eioly1WPddottY",
                javascript_key: "Tgozw1FvRVn8gGDKugHTXY6CRlwtDzfFH1Yet56I"
        });


        definitions = {
                book: {
                        table: 'Book',
                        parse_update_delay: 0,
                        attributes: {
                                title: { required: true, unique: true },
                                author: { link_to: 'Author' },
                                type: {},
                                chapters: { link_to: ['Chapter'] }
                        }

                },
                author: {
                        table: 'Author',
                        parse_update_delay: 0,
                        attributes: {
                                name: { required: true }
                        }
                },
                chapter: {
                        table: 'Chapter',
                        parse_update_delay: 0,
                        attributes: {
                                title: { required: true },
                                book: { link_to: 'Book' }
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

                                $q.when(model.book.update_promise).then(function() {

                                        assert(console.history).should.contain([
                                                "Created model which wraps table: Book",
                                                "Retrieved 0 cached records for Book",
                                                "Retrieved 0 Parse records for Book",
                                                "Removed 0 records from Book",
                                                "Saved to local cache (Book)",
                                        ]).then().process_promise(deferred, true, "could not find expected console info: ###")

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

                                                assert(records.length).should.equal(1).then().process_promise(deferred, true, "was expecting to find !expected! records, but found !actual!")

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

                                        assert(model.book.data.length)
                                                .should.equal(1)
                                                .then().process_promise(deferred,false, "was expecting to find !expected! books before the test, but found !actual!")


                                        console.clear_history();                                       
                                        model.book.recache().then(function() {

                                                assert(model.book.data.length)
                                                        .should.equal(2)
                                                        .then().process_promise(deferred,false, "was expecting to find !expected! books before the test, but found !actual!")

                                                assert(console.history)
                                                        .should.contain("Book.attribute has a relationship with Chapter, but this model didn't exist")
                                                        .then().process_promise(deferred,true, "should warn the use that a related model hasn't been created, but didn't")

                                        })

                                }


                                prepopulate();

                                return deferred.promise
                        } 
                },
                { 
                        title: "Records should load from cache, rather than making Parse requests every time",
                        doTest: function() {
                                var deferred = $q.defer()

                                model.book = new ParseConnector.Model(definitions.book)
                                $q.when(model.book.update_promise).then(function(){

                                        assert(console.history)
                                                .should.contain("Retrieved 2 cached records for Book")
                                                .then().process_promise(deferred, false, "did not seem to pull the records from the cache")

                                        assert(model.book.data.length).should.equal(2)
                                                .then().process_promise(deferred,false, "expected !expected! books, but found !actual!")

                                        assert(console.history)
                                                .should_not.contain("Retrieved 2 Parse records for Book")
                                                .then().process_promise(deferred, true, "seems to have pulled a parse record when it shouldn't")

                                })

                                return  deferred.promise
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

                                        found_records = model.book.filterBy({type:"Hardback"})

                                        assert(model.book.data.length).should.equal(6)
                                                .then().process_promise(deferred, false, "was expecting !expected! records before test, but found !actual! ")

                                        assert(found_records.length).should.equal(4)
                                                .then().process_promise(deferred,true, "was expecting to find !expected! records, but found !actual!")
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

                                assert(updateRecord.title).should.equal("Book Six")
                                        .then().process_promise(deferred, false, "expected existing title to be !expected!, but it was !actual!")

                                updateRecord.title="xxx"
                                updateRecord.save().then(function() {

                                        (new Parse.Query(model.book.table))
                                                .get(updateRecord.id).then(function(record) {

                                                assert(record.get("title")).should.equal(updateRecord.title)
                                                        .then().process_promise(deferred, true, "expected title of parse record to be '!expected!', but it was '!actual!'")                                                

                                        } ) 

                                })

                                return  deferred.promise
                        } 
                },
                { 
                        title: "records updated somewhere else should enter the localcache",
                        doTest: function() {
                                var deferred = $q.defer()

                                var updateRecord = model.book.filterBy({title: "xxx"})[0]

                                assert(updateRecord.title).should.equal("xxx")
                                        .then().process_promise(deferred, false, "expected existing title to be !expected!, but it was !actual!");

                                (new Parse.Query(model.book.table)).get(updateRecord.id).then(function(record) {
                                        record.set('title',"delete_me")
                                        record.save().then(function () {

                                                model.book.recache().then(function() {
                                                        updateRecord = model.book.filterBy({id: updateRecord.id})[0]

                                                        assert(updateRecord.title).should.equal("delete_me")
                                                                .then().process_promise(deferred, true, "expected title to have changed to !expected!, but it was !actual!");

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
                                var recordCount = model.book.data.length

                                assert(recordCount).should.equal(6).then().process_promise(deferred,false, "expecting !expected! records before test, but found !actual!")

                                deleteRecord.delete().then(function() {

                                        recordCount--;

                                        assert(model.book.data.length).should.equal(recordCount)
                                                .then().process_promise(deferred,false, "expecting !expected! records in model.book.data, but found !actual!")


                                        assert(JSON.parse( window.localStorage.getItem(model.book.table) ).data.length).should.equal(recordCount)
                                                .then().process_promise(deferred,false, "expecting !expected! records in localStorage, but found !actual!")

                                        var query = new Parse.Query(model.book.table)
                                        query.get(deleteRecord.id).then(function(record) {                                                                
                                                deferred.reject("should not have found deleted record, but did")                                                                
                                        }, function() {
                                                deferred.resolve()
                                        })


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

                                                                assert(record_to_delete.length).should.equal(0)
                                                                        .then().process_promise(deferred,true,"shouldn't have been able to find deleted record in local, but could")


                                                        })                                                        

                                                })

                                        })

                                })



                                return  deferred.promise
                        } 
                },
                { 
                        title: "fields with *one-to-one attribute ( link_to: 'table' )* should automatically populate",
                        doTest: function() {
                                var deferred = $q.defer()

                                var target_book = model.book.filterBy({ title: "Book One" })[0]
                                var target_author

                                var prepopulate = function() { 

                                        model.author = new ParseConnector.Model(definitions.author)
                                        $q.all([model.author.update_promise, target_book.fetch()]).then(function() {

                                                target_author = model.author.new({ name: "Joe Bloggs" })
                                                target_author.save().then(function() {

                                                        target_book.parseObject.set("author", target_author.parseObject)
                                                        target_book.parseObject.save().then(doTest)

                                                })

                                        })

                                }

                                var doTest = function () {                             

                                        window.localStorage.removeItem(model.book.table)
                                        window.localStorage.removeItem(model.author.table)

                                        model.book=new ParseConnector.Model(definitions.book)
                                        model.author=new ParseConnector.Model(definitions.author)

                                        $q.when(model.book.relationship_update_promise).then(function() {

                                                var target_book = model.book.filterBy({ title: "Book One" })[0]
                                                var target_author = model.author.filterBy({ name: "Joe Bloggs" })[0] || "not found"

                                                assert(target_author).should_not.equal("not found")
                                                        .then().process_promise(deferred, false, "could not found reference author")

                                                assert(target_book.author).should.equal(target_author)
                                                        .then().process_promise(deferred, false, "target author wasn't woven into the target book when pulled from parse")

                                                target_book = JSON.parse(window.localStorage.getItem(model.book.table)).data.filter(function(book) {
                                                        if(book.id==target_book.id) return true;
                                                        return false
                                                })
                                                target_book=target_book[0]
                                                                                               
                                                assert(typeof target_book.author)
                                                        .should_not.equal("undefined").then().process_promise(deferred, false, "the relationship wasn't saved in the localcache")

                                                assert(target_book.author)
                                                       .should.equal(target_author.id).then().process_promise(deferred, false, "the relationship wasn't saved as an ID in the localcache")

                                                console.clear_history()

                                                model.author=new ParseConnector.Model(definitions.author)                                                        
                                                model.book=new ParseConnector.Model(definitions.book)

                                                $q.when(model.book.relationship_update_promise).then(function() {

                                                        var target_book = model.book.filterBy({ title: "Book One" })[0]
                                                        var target_author = model.author.filterBy({ name: "Joe Bloggs" })[0] || "not found"

                                                        assert(console.history).should.contain(["Saved to local cache (Author)"])
                                                                .then().process_promise(deferred,false, "relationship_update_promises were resolving before the record was updated")

                                                        assert(console.history).should.contain(["Retrieved 0 Parse records for Book", "Retrieved 0 Parse records for Author"])
                                                                .then().process_promise(deferred,false, "pulling records from parse when it shouldn't")

                                                        assert(target_author).should_not.equal("not found")
                                                                .then().process_promise(deferred, false, "could not found reference author (localcache)")

                                                        assert(target_book.author).should.equal(target_author)
                                                                .then().process_promise(deferred, true, "target author wasn't woven into the target book when pulled from localcache")

                                                })

                                        })                                       

                                }

                                prepopulate()

                                return  deferred.promise
                        } 
                },    

                { 
                        title: "###one-to-one fields should accept an existing object as a value",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },    
                { 
                        title: "###one-to-one fields should create an object when passed a hash object",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },
                { 
                        title: "###when an object associated with a one-to-one attribute is deleted, it should be dynamically removed from that attribute",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },
                { 
                        title: "###fields with a *one-to-many attribute ( link_to:['table'] ), should automatically populate",
                        doTest: function() {
                                var deferred = $q.defer()

                                var target_book = model.book.filterBy({ title: "Book One" })[0]

                                var new_chapters = ["Chapter One", "Chapter Two", "Chapter Three"]

                                var prepopulate = function() { 

                                        model.chapter = new ParseConnector.Model(definitions.chapter)
                                        $q.all(model.chapter.update_promise).then(function() {

                                                var prepopulation_promises = []

                                                new_chapters.forEach(function(chapter) {
                                                        prepopulation_promises.push(model.chapter.new({title: chapter}).save())
                                                })

                                                $q.all(prepopulation_promises).then(function() {
                                                        model.chapter.data.forEach(function(chapter) {

                                                                target_book.parseObject.relation("chapters").add(chapter.parseObject)
                                                        })                      
                                                        target_book.parseObject.save().then(doTest)
                                                })
                                        })

                                }

                                var doTest = function () {                             

                                        window.localStorage.removeItem(model.book.table)
                                        window.localStorage.removeItem(model.chapter.table)

                                        model.book=new ParseConnector.Model(definitions.book)
                                        model.chapter=new ParseConnector.Model(definitions.chapter)

                                        $q.when(model.book.relationship_update_promise).then(function() {

                                                var target_book = model.book.filterBy({ title: "Book One" })[0]

                                                assert(target_book.chapters.length).should.equal(3)
                                                        .then().process_promise(deferred, false, "expected !expected! chapters from Parse, but found !actual!")

                                                assert(target_book.chapters.map(function(chapter) { return chapter.title })).should.contain("Chapter One")
                                                        .then().process_promise(deferred,true,"expected chapters array to include !expected! when pulled from parse, but it didn't")

                                                target_book = JSON.parse(window.localStorage.getItem(model.book.table)).data.filter(function(book) {
                                                        if(book.id==target_book.id) return true;
                                                        return false
                                                })

                                                assert(1).should.equal(2).then().process_promise(deferred, false, "MARK")

                                                assert(typeof target_book.chapters)
                                                        .should.equal("undefined").then().process_promise(deferred, false, "the relationship wasn't saved in the localcache")

                                                model.book=new ParseConnector.Model(definitions.book)
                                                model.chapter=new ParseConnector.Model(definitions.chapter)

                                                $q.when(model.book.relationship_update_promise).then(function() {

                                                        var target_book = model.book.filterBy({ title: "Book One" })[0]

                                                        assert(target_book.chapters.length).should.equal(3)
                                                                .then().process_promise(deferred, false, "expected !expected! chapters from localStorage, but found !actual!")

                                                        assert(target_book.chapters[2].title).should.equal("Chapter One")
                                                                .then().process_promise(deferred,true,"expected first chapter to be called !expected!, but it was !actual! when pulled from localStorage")

                                                })



                                        })


                                }

                                target_book.fetch().then(prepopulate)

                                return  deferred.promise
                        } 
                }, 
                { 
                        title: "###one-to-many fields should accept an existing object through .add",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                }, 
                { 
                        title: "###one-to-many fields should create an object when passed a hash object",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },                
                { 
                        title: "###when an object associated with a one-to-many attribute is deleted, it should be dynamically removed from that attribute",
                        doTest: function() {
                                var deferred = $q.defer()

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                }, 
                { 
                        title: "Dummy Test",
                        doTest: function() {
                                var deferred = $q.defer()

                                console.log(model)

                                deferred.resolve()                               

                                return  deferred.promise
                        } 
                },              

        ]         

        test_number=0
        execute_test = function (test_number) {

                console.clear_history();

                var f = "font-weight: bold; text-decoration: underline;" + 
                    (tests[test_number].title.substring(0,3)=="###" ? "color:orange;" : "")

                console.debug("%cRUNNING TEST #"+test_number+": "+ tests[test_number].title, f)

                tests[test_number].doTest().then(function() {
                        console.debug("%c✔ Test Successful", "color:green;  ")
                        console.debug(" ")

                        if (tests.length-1>test_number) {
                                test_number++
                                window.setTimeout(function() { execute_test(test_number) }, 500, this)
                        } else {
                                console.debug("%cAll Tests Now Complete!", "font-weight: bold; text-decoration: underline;")                
                        }

                }, function (e) {
                        console.debug("%c✖ Test Failed: "+e, "color:red")
                        console.debug(model)

                })

        }

        var assert = function(actual_value) {

                var root = this

                var actual_value=actual_value

                var comparators = {
                        should: { comparator: 'should' },
                        should_not: { comparator: 'should_not'}
                }


                var tests = {      

                        resolutions: {
                                _resolution: false,
                                expected_value: null, 
                                then: function(function_to_call) {
                                        if(function_to_call) function_to_call(this._resolution)
                                        return {
                                                _resolution: this._resolution,
                                                expected_value: this.expected_value,

                                                assert: root,

                                                process_promise: function(promise, resolve, reject) {
                                                        if(this._resolution===true && resolve) {
                                                                promise.resolve()
                                                        } else if(this._resolution!=true && reject) {
                                                                reject = reject || "###"                                                                
                                                                reject = reject.replace("!actual!", actual_value)
                                                                reject = reject.replace("!expected!", this.expected_value)
                                                                reject = reject.replace("###", this._resolution)
                                                                promise.reject(reject)
                                                        }
                                                }
                                        }
                                }
                        },

                        equal: function(expected_value) {                                
                                test=this
                                test.resolutions.expected_value=expected_value
                                test.resolutions._resolution = expected_value===actual_value

                                if(this.comparator=="should_not") test.resolutions._resolution = !test.resolutions._resolution;

                                return test.resolutions
                        },

                        contain: function(expected_values) {

                                test=this                                
                                test.resolutions._resolution = ""

                                var expected_values = expected_values

                                if(typeof expected_values == "string") {
                                        expected_values=[expected_values]
                                }

                                expected_values.forEach(function(expected_value) {

                                        if(test.comparator=="should") {
                                                if (!actual_value.toString().includes(expected_value)) test.resolutions._resolution+="'"+expected_value+"';";                                                
                                        } else if (this.comparator=="should_not") {
                                                if (actual_value.toString().includes(expected_value)) test.resolutions._resolution+="'"+expected_value+"';";                                                
                                        }

                                })

                                if (test.resolutions._resolution=="") { test.resolutions._resolution=true; }

                                return test.resolutions                               
                        }  
                }


                for(comparator in comparators) {
                        for(test in tests) {
                                comparators[comparator][test] = tests[test]
                        }
                }

                return comparators

        };


        (new (Parse.Object.extend("Book"))).save({title: "Book Two", type: "Paperback"})
                .then(function(result) { 

                var time_offset = Math.ceil((new Date(result.createdAt).getTime() - new Date().getTime())/1000)

                for(definition in definitions) {
                        definitions[definition].time_offset = time_offset
                }

                execute_test(0)


        })

        return

});