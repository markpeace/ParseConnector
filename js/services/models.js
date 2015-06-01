app.service('Models', function(ParseConnector, $q) {


        model = ParseConnector.initialise({
                app_id: "edND7HJo79GX6cn3r6hiArH5w6eioly1WPddottY",
                javascript_key: "Tgozw1FvRVn8gGDKugHTXY6CRlwtDzfFH1Yet56I"
        })





        model.group = new ParseConnector.Model({
                table: 'Book',
                attributes: {
                        title: {}
                }
        })

        model.chapter = new ParseConnector.Model({
                table: 'Chapter',
                attributes: {
                        title: {}
                }
        })

        //console.log(model.group)
        //console.log(model.chapter)

        return model


});