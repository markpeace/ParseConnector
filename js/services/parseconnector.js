app.service('ParseConnector', function($q) {

        extend_native_objects = function () { //EXTEND NATIVE OBJECTS WITH ADDITIONAL POWERS

                Object.prototype.apply_defaults = function (defaults) {   
                        object = this
                        defaults = defaults || {}        
                        for(key in defaults) { object[key] = object[key]!=null ? object[key] : defaults[key] }      
                }

                Object.prototype.enforce_requirements = function (fields) {
                        fields = fields || {}
                        for(key in fields) {
                                if(!this[key]) {
                                        return key+" is a required field";
                                }
                        }
                        return null;
                }

                Object.prototype.forEach = function(function_to_run) {
                        object=this
                        for (key in object) {
                                if(object.hasOwnProperty(key)){
                                        function_to_run(key, object[key])                                        
                                }
                        }
                }

        }();

        var Models = {}

        var initialise = function(options) {                        //CONNECTS TO PARSE AND RETURNS A SHARED MODEL OBJECT
                options = options || {}              
                options.apply_defaults({})
                if ( e = options.enforce_requirements({ app_id: true, javascript_key: true }) ) { console.log(e); return; } 

                Parse.initialize(options.app_id, options.javascript_key);    

                return Models;
        }


        //MODEL DEFINITIONS
        var Model = function (options) {                            // CREATES A NEW MODEL

                // Set up options and enforce any enforced parameters
                options = options || {}
                options.apply_defaults({
                        //REQUIRED VALUES                
                        table: null,                            // parse table to draw data from
                        attributes: {},                         // definition of fields within the table
                        //OPTIONAL VALUES
                        constraints: [],                        // query constraints
                        parse_update_delay: 60,                 // how long to wait between each check for parse updates (mins)   
                        //BUILT-IN VALUES      
                        last_retrieved: null,                   // timestamp indicating when data was last recached from parse
                        update_promise: null                    // this is filled with a promise when updating
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
                        
                        var deferred = $q.defer()
                        
                        _model.update_promise=deferred.promise

                        var retrieve_cached_data = function () {                // retrieves cached data, and checks for an update
                                _model.data=[]

                                //window.localStorage.removeItem(_model.table)

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
                                                _model.new(parse_record).fetch();
                                        })

                                        console.info("- Retrieved "+parse_recordset.length+" Parse records for "+_model.table)
                                        _model.last_retrieved = (new Date()).toISOString();
                                        _model.cache();
                                        
                                        deferred.resolve();
                                })

                        }

                        retrieve_cached_data();

                }

                _model.cache = function () {
                        var data_to_cache = []
                        _model.data.forEach(function(record) {
                                var record_to_cache = {}

                                _model.attributes.forEach(function(attribute) {
                                        record_to_cache[attribute] = record[attribute]
                                })

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

                        if (preset.last_retrieved) {                    //A CACHED OBJECT HAS BEEN PASSED
                                _model.attributes.forEach(function (key) {
                                        _newRecord[key] = preset[key]
                                })
                        } else if (preset.cid) {                        //A PARSE OBJECT HAS BEEN PASSED
                                _newRecord.parseObject = preset
                        }

                        _newRecord.fetch = function() {
                                for(attribute in _model.attributes) {                                        
                                        if(_model.attributes.hasOwnProperty(attribute)) {
                                                _newRecord[attribute] = preset.get(attribute)
                                        }
                                }
                                _newRecord.id = preset.id
                                _newRecord.last_retrieved = new Date().toISOString()
                        }

                        _model.data.push(_newRecord)
                        return _newRecord
                }
                
                _model.filterBy = function (options) {
                        options=options || {}
                        
                        return _model.data.filter(function(record) {
                                options.forEach(function(filter_key, filter_value) {
                                        if(record[filter_key]!=filter_value) return false;
                                })
                                return true
                        })
                        
                }

                _model.recache();
        }



        return {
                initialise: initialise,
                Model: Model,
        }


});