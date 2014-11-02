NPM Browser
========

NPM Browser is an offline-first HTML5 app that replicates most of NPM into your browser. It's designed as a demo showcase for [PouchDB](http://pouchdb.com).

How it works
------

NPM is largely built on top of CouchDB. In fact, the main repository data is stored in two databases: the *skim* DB and the *fullfat* DB:

* [https://skimdb.npmjs.com/registry](https://skimdb.npmjs.com/registry) (skim)
* [https://registry.npmjs.com/](https://registry.npmjs.com/) (fullfat)

The skim DB contains only project metadata (e.g. versions, maintainers, READMEs), whereas the fullfat DB also contains tarball binaries.

In any case, since CouchDB uses the same replication protocol as PouchDB, the NPM Browser replicates the skim DB to your browser.

PouchDB tricks
-------

Since even the skim DB is a huge database (as of this writing, the `.couch` file is ~600MB), we needed some tricks in order to get the app to perform speedily and efficiently.

### filter-pouch

[filter-pouch](https://github.com/nolanlawson/filter-pouch) is used to filter incoming documents and trim away unneeded data before storing it in the local database. This ensures that we don't quickly reach browser usage limits, and that in browsers where we have to request data upfront (i.e. Safari), we don't have to request very much.

### pouchdb-load

[pouchdb-load](https://github.com/nolanlawson/pouchdb-load) and [pouchdb-dump-cli](https://github.com/nolanlawson/pouchdb-dump-cli) were used so that the initial replication doesn't take an inordinate amount of time.

CouchDB replication is pretty chatty, so we work around this by decomposing it into a [replication stream](https://github.com/nolanlawson/pouchdb-replication-stream) which we can then store as [plaintext static files hosted on Amazon S3](http://shrub.appspot.com/nolanlawson/npm-browser/).

Once initial replication is complete, the app switches over to regular replication. As modules are added, modified, and deleted, the app should update in realtime.

### Skim DB mirror

Unfortunately, since SkimDB still doesn't support CORS (as of this writing), we have a simple IrisCouch mirror set up at [http://skimdb.iriscouch.com/registry](http://skimdb.iriscouch.com/registry). Using the real Skim DB is a TODO.

### Web SQL

This app prefers Web SQL to IndexedDB because in Chrome it appears to perform better.

HTML5 tricks
------

We use App Cache so that the app can work offline. Add it as a bookmark to your home screen, and notice how it still continues to work!