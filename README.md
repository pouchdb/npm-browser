Yeoman Angular Jade Seed
========================

Love using [the Yeoman Angular generator](https://github.com/yeoman/generator-angular), but disappointed that
you can't use Jade instead of HTML?  This seed is for you.

Just check out this project and rename all instances of `yeomanAngularJadeSeed`/`yeomanangularjadeseed` to your app's name.  That's it.

If you're handy with Git, you can even just run `yo angular` yourself, and then apply [this commit](https://github.com/nolanlawson/yeoman-angular-jade-seed/commit/7cf632fd7d1dd1f7020d3c22639c0f773abd0fad) to add Jade.

How does it work?
----

This seed app was built with Yeoman 1.1.2 using

    yo angular

... plus all the trimmings: Sass, Bootstrap, Bootstrap-Sass, angular-resource, 
angular-cookies, angular-sanitize, angular-route.

Then I just replaced the HTML with Jade, following 
[these instructions](http://thephuse.com/development/short-circuits-using-jade-templates-with-yeoman/).  Simple as that.


Workflow
------

It's Yeoman!  To run in dev mode:

    grunt serve
    
To build:

    grunt build

To test:

    grunt test
    
It all works with Jade.  Grunt-watch will even watch your Jade changes and 
instantly transform them into HTML.  Magic!
    
Future
--------

Consider this project deprecated when [the Jade feature](https://github.com/yeoman/generator-angular/pull/420) has been added to the Yeoman Angular generator.