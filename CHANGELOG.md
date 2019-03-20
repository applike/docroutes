# Revision history for docroutes

## 0.0.4 -- 2019-03-20

* Fixed a bug where `foo?: type` would get the type `type` instead of `type | undefined`

## 0.0.3 -- 2019-03-20

* Added support for object literal types
* Added support for `keyof` operator
* Added error class containing a trace to the type causing it

## 0.0.2 -- 2019-03-20

* Fixed problems with typescript (`dist` directory not uploaded)
* Fixed `docroutes` script in `bin` directory

## 0.0.1 -- 2019-03-20

* First version. Released on an unsuspecting world.
