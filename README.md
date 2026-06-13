# [MPEG-H 3D Web Decoder](https://run4r-ses.github.io/mpeghdeconline/)
This is a wrapper around libmpegh's testbench to provide MPEG-H 3D / 360 Reality Audio decoding on web browsers.

## Limitations
- WebKit on iOS is an experimental configuration.
- Selecting a non-MPEG-H 3D file will cause the decoder to hang for 1 minute before throwing an error.

## License
This project is licensed under the MIT License.

libmpegh is licensed under BSD-3-Clause-Clear License.
For more information, see [LICENSE](https://github.com/ittiam-systems/libmpegh/blob/main/LICENSE)
