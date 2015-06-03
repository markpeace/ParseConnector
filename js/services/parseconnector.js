app.service('ParseConnector', function($q) {

        var apply_helper_functions = function(target) {

                target = target || object

                target.apply_defaults = function (defaults) {   
                        object = this
                        defaults = defaults || {}        
                        for(key in defaults) { object[key] = object[key]!=null ? object[key] : defaults[key] }      
                }

                target.enforce_requirements = function (fields) {
                        fields = fields || {}
                        for(key in fields) {
                                if(!this[key]) {
                                        return key+" is a required field";
                                }
                        }
                        return null;
                }

                target.forEach = function(function_to_run) {
                        object=this
                        for (key in object) {
                                if(object.hasOwnProperty(key)){
                                        function_to_run(key, object[key])                                        
                                }
                        }
                }


        }

        var Models = {}

        var initialise = function(options) {                        //CONNECTS TO PARSE AND RETURNS A SHARED MODEL OBJECT
                apply_helper_functions(options)

                options.apply_defaults({})
                if ( e = options.enforce_requirements({ app_id: true, javascript_key: true }) ) { console.log(e); return; } 

                Parse.initialize(options.app_id, options.javascript_key);    

                return Models;
        }



        //MODEL DEFINITIONS
        var Model = function (options) {                            // CREATES A NEW MODEL

                // Set up options and enforce any enforced parameters
                apply_helper_functions(options)

                options.apply_defaults({
                        //REQUIRED VALUES                
                        table: null,                            // parse table to draw data from
                        attributes: {},                         // definition of fields within the table
                        //OPTIONAL VALUES
                        constraints: [],                        // query constraints
                        parse_update_delay: 60,                 // how long to wait between each check for parse updates (mins)   
                        //BUILT-IN VALUES      
                        last_retrieved: null,                   // timestamp indicating when data was last recached from parse
                        update_promise: $q.defer()              // this is filled with a promise when updating
                });
                options.attributes.id = {}
                options.attributes.last_retrieved = {}
                if ( e = options.enforce_requirements({ table: true, attributes: true }) ) { console.log(e + " when initialising model"); return }

                // Basic setup  
                var _model = this        
                for (key in options) { _model[key] = options[key] }
                _model.data = new Array();
                console.info("Created model which wraps table: " + _model.table)

                _model.recache = function () {

                        if(_model.update_promise.promise.$$state.status!=0) _model.update_promise=$q.defer()

                        var retrieve_cached_data = function () {                // retrieves cached data, and checks for an update
                                _model.data=[]

                                var cached_data = JSON.parse(window.localStorage.getItem(_model.table)) || { last_retrieved: null, data: [] }
                                cached_data.data.forEach(function(cached_record) {
                                        _model.new(cached_record)
                                })

                                _model.last_retrieved = cached_data.last_retrieved

                                console.info("- Retrieved "+cached_data.data.length+" cached records for "+_model.table)
                                retrieve_parse_data(cached_data.last_retrieved)
                        }

                        var retrieve_parse_data = function (last_retrieved) {                 // retrieves parse data since the last update

                                last_retrieved = last_retrieved || (new Date("1/1/01")).toISOString()
                                var next_retrieval = (new Date(last_retrieved)).getTime() + (_model.parse_update_delay * 60 * 1000)

                                if(new Date(next_retrieval).getTime() > new Date().getTime()) {
                                        console.log(new Date(next_retrieval).getTime() - new Date().getTime())
                                        console.info("- Parse updated skipped for " + _model.table)
                                        deferred.resolve();
                                        return;
                                }

                                var query = new Parse.Query(_model.table);
                                _model.constraints.forEach(function(constraint) {
                                        query=eval("query" + constraint)   
                                })                                
                                query.greaterThan('updatedAt', last_retrieved)                               
                                query.limit(9999)                                
                                query.find().then(function(parse_recordset) {

                                        parse_recordset.forEach(function(parse_record) {

                                                var existing_record = _model.filterBy({id:parse_record.id})

                                                if(existing_record.length>0) {
                                                        existing_record=existing_record[0]
                                                        existing_record.parseObject=parse_record
                                                        existing_record.fetch()
                                                } else {
                                                        _model.new(parse_record).fetch();                                                        
                                                }

                                        })

                                        console.info("- Retrieved "+parse_recordset.length+" Parse records for "+_model.table)
                                        _model.last_retrieved = (new Date()).toISOString();

                                        retrieve_parse_deleted(last_retrieved)

                                })

                        }

                        var retrieve_parse_deleted = function (last_retrieved) {

                                var query = new Parse.Query("pc_system");
                                query.greaterThan('updatedAt', last_retrieved)                             
                                query.equalTo('table', _model.table)
                                query.equalTo('action', 'deleted')
                                query.limit(9999)                                
                                query.find().then(function(parse_recordset) {
                                        parse_recordset.forEach(function (parseRecord) {
                                                _model.data = _model.data.filter(function(r){
                                                        return !(r.id==parseRecord.get('target_id'))
                                                })                                                
                                        })
                                        console.info("- Removed " + parse_recordset.length + " records from " +_model.table)
                                        _model.cache();
                                        _model.update_promise.resolve();
                                })
                        }

                        retrieve_cached_data();

                        return _model.update_promise.promise

                }

                _model.cache = function () {
                        var data_to_cache = []
                        _model.data.forEach(function(record) {
                                var record_to_cache = {}

                                for(attribute in _model.attributes) {
                                        record_to_cache[attribute] = record[attribute]
                                }                                

                                data_to_cache.push(record_to_cache)
                        })

                        data_to_cache = {
                                last_retrieved: _model.last_retrieved,
                                data: data_to_cache
                        }

                        window.localStorage.setItem(_model.table, JSON.stringify(data_to_cache))
                        console.info("- Saved to local cache ("+ _model.table +")")
                }

                _model.new = function(preset) {

                        preset = preset || {}

                        var _newRecord = {}
                        _newRecord.parent=_model
                        _model.data.push(_newRecord)

                        if (preset.cid) {                               //A PARSE OBJECT HAS BEEN PASSED
                                _newRecord.parseObject = preset
                        } else {                                        //A BRAND NEW OR CACHED OBJECT HAS BEEN PASSED 

                                for(key in _model.attributes) {
                                        _newRecord[key]=preset[key]
                                }

                        }

                        _newRecord.save = function () {
                                var deferred = $q.defer()

                                var processValidations = function() {

                                        var error_messages = ""

                                        promises =[]


                                        for(attribute in _model.attributes) {

                                                //VALDATIONS - REQUIRED FIELD
                                                if(_model.attributes[attribute].required && !_newRecord[attribute]) error_messages=error_messages+"- a value must be provided for"+attribute;                                                        

                                                //VALIDATIONS - UNIQUE FIELD
                                                if(_model.attributes[attribute].unique) {
                                                        var query = new Parse.Query(_model.table)
                                                        query.equalTo(attribute, _newRecord[attribute])
                                                        var unique_promise = $q.defer()
                                                        promises.push(unique_promise.promise)
                                                        query.count().then(function(record_count) {
                                                                if(record_count>0)  error_messages+="- " + attribute + " must be a unique value";
                                                                unique_promise.resolve();
                                                        })
                                                }                                               
                                        }

                                        $q.all(promises).then(function() {
                                                if (error_messages) {

                                                        _model.data.pop()

                                                        deferred.reject(error_messages)      
                                                } else { findParseObject (); }
                                        })
                                }

                                var findParseObject = function () {
                                        if(_newRecord.id) {                     //IF IT'S AN EXISTING RECORD     
                                                if(_newRecord.parseObject) {            //and it has a parse record attached
                                                        performSave()
                                                } else {                                //otherwise fetch the existing one
                                                        _newRecord.fetch(true).then(performSave)
                                                }
                                        } else {                                //OTHERWISE CREATE A RECORD
                                                _newRecord.parseObject = new (Parse.Object.extend(_model.table))
                                                performSave();
                                        }
                                }

                                var performSave = function() {    

                                        for (key in _model.attributes) {
                                                if(key!="last_retrieved") {_newRecord.parseObject.set(key, _newRecord[key])}
                                        }

                                        _newRecord.parseObject.save().then(function(saved_record) {

                                                _newRecord.id = saved_record.id

                                                _newRecord.last_retrieved=new Date().toISOString()
                                                _model.cache()

                                                deferred.resolve()
                                        })

                                }

                                processValidations()

                                return deferred.promise
                        }

                        _newRecord.fetch = function(onlyParseObject) {

                                var deferred = $q.defer();

                                getObject = function() {
                                        if(!_newRecord.parseObject) {

                                                (new Parse.Query(_model.table))
                                                        .get(_newRecord.id).then(function(parseobject) {        

                                                        _newRecord.parseObject=parseobject
                                                        if(!onlyParseObject)  {
                                                                getValues();
                                                        } else {
                                                                deferred.resolve();                                                        
                                                        }

                                                })
                                        } else {
                                                if(!onlyParseObject) { 
                                                        getValues();
                                                } else {                                                        
                                                        deferred.resolve();
                                                }
                                        }
                                }

                                getValues = function() {
                                        for(attribute in _model.attributes) {                                        
                                                if(_model.attributes.hasOwnProperty(attribute)) {

                                                        if(typeof _model.attributes[attribute].link_to=="string") {
                                                                console.debug("o2o"+attribute)
                                                        } else if(typeof _model.attributes[attribute].link_to=="object") {
                                                                console.debug("o2m"+attribute)
                                                        } else {
                                                                _newRecord[attribute] = _newRecord.parseObject.get(attribute)                                                                
                                                        }

                                                }
                                        }
                                        _newRecord.id = _newRecord.parseObject.id
                                        _newRecord.last_retrieved = new Date().toISOString()
                                        deferred.resolve();                                        
                                }

                                getObject();

                                return deferred.promise

                        }

                        _newRecord.delete = function () {

                                var deferred = $q.defer();

                                getObject = function () {
                                        if(!_newRecord.parseObject) {                                                               
                                                _newRecord.fetch(true).then(function() {
                                                        doDelete()
                                                })
                                        } else {
                                                doDelete()
                                        }                                                          

                                }

                                doDelete=function() {

                                        (new (Parse.Object.extend("pc_system"))).save({
                                                target_id: _newRecord.id,
                                                table: _model.table,
                                                action: 'deleted'
                                        }).then(function() {                                                          
                                                _newRecord.parseObject.destroy().then(function() { 
                                                        _model.data = _model.data.filter(function(r) {                                                                
                                                                return !(r.id==_newRecord.id) 
                                                        })         

                                                        _model.cache();

                                                        deferred.resolve(); 
                                                })                                                                                                
                                        })                                                                                                                   
                                }

                                getObject();

                                return deferred.promise

                        }

                        return _newRecord
                }

                _model.filterBy = function (filter) {
                        filter=filter || {}

                        if (_model.data) {
                                return _model.data.filter(function(record) {     

                                        for(key in filter) {
                                                if(record[key]!=filter[key]) return false
                                                        }

                                        return true

                                })
                        }

                }

                _model.recache();
        }



        return {
                initialise: initialise,
                Model: Model,
        }


});