app.service('Models', function(ParseConnector, $q) {


        model = ParseConnector.initialise({
                app_id: "edND7HJo79GX6cn3r6hiArH5w6eioly1WPddottY",
                javascript_key: "Tgozw1FvRVn8gGDKugHTXY6CRlwtDzfFH1Yet56I"
        })





        model.book = new ParseConnector.Model({
                table: 'Book',
                parse_update_delay: 0,
                attributes: {
                        title: {}
                }
        })

        model.chapter = new ParseConnector.Model({
                table: 'Chapter',
                parse_update_delay: 0,                
                attributes: {
                        title: {}
                }
        })

        model.book.update_promise.then(function(){
                console.log(model.book)                
                
        })
        
        model.chapter.update_promise.then(function(){
                console.log(model.chapter)
        })
        
        return model


});