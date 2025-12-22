# [MPEG-H 3D Web Decoder](https://run4r-ses.github.io/mpeghdeconline/)
This is a wrapper around libmpegh's testbench to provide MPEG-H 3D / 360 Reality Audio decoding on web browsers.

## Limitations
- Currently, the file is processed in memory and the output is also stored this way,
which means the decoder can eat up a very large amount of memory, especially for 22.2 output.
For this reason, we recommend **2GB or above** of available RAM to the tab when running this tool.
- Certain configurations such as iOS (specifically WebKit on iOS) cannot be tested and therefore won't be supported, and some users have reported crashes so keep in mind.

## License
This project is licensed under the MIT License.

libmpegh is licensed under BSD-3-Clause-Clear License.
For more information, see [LICENSE](https://github.com/ittiam-systems/libmpegh/blob/main/LICENSE)
