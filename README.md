![Mockups of different devices showing the app](./mockups.png)


# CicloMapa

## An open platform to democratize access to bike maps of brazilian cities, combining the collaborative power of  with web technologies and easy-to-use design.

Today in Brazil we face a big challenge of not having data on the cycling infrastructure available in our cities. This makes it very hard to paint a clear picture of our reality and calculate the relevant metrics to measure the opportunities and impacts to society of improving urban mobility. The most common problems are data not being standardized, making it hard to compare between localities, data not being available publicly or sometimes it not existing at all.

[UCB (Brazil Cyclists Union)](https://www.uniaodeciclistas.org.br) and [ITDP (Transport and Development Policy Institute)](https://itdpbrasil.org/) are two civil society organizations that have joined forces to solve once and for all the problem of access to data on Brazil's cycling infrastructure.

We've developed the first cycling maps platform encompassing all Brazilian cities, leveraging the data and collaborativity of [OpenStreetMap (OSM)](https://www.openstreetmap.org/), the biggest initiative of this kind. We've created an open-source web application, free and accessible from any computer or smartphone, aimed at both the average citizen who wants to know more about their city, and researchers, who will have easy access to data without needing OSM knowledge.


📕 [Full case study](https://cristianodalbem.com/ciclomapa/)

🎓 [UCB website with more useful links and tutorials on OSM](https://www.uniaodeciclistas.org.br/atuacao/ciclomapa)


## Main features

- **Easily visualize** the different kinds of cycling structure of any brazilian city. We simplified all the technical details of OSM so everyone can understand it.
- **Learn** about what are the main types of cycling structures you can find around. Semantic colors help you remember that some are better than others.
- **Download the GeoJSON data** with a single button click so you can import in your favorite GIS application and power up your research analysis.
- Found something wrong? A **direct link** will take you to the OSM web editor so you can fix it and contribute.


## Architecture

The basic premise is that the OSM Overpass API is *very* slow and we couldn't hit it directly without damaging a lot the user experience. However, differently than other similar projects, we didn't want to have data stuck in time, since we want contributors to be continually improving the data.

We store a mirror of the OSM data in a Firebase Database. Any user (possibly an OSM contributor) can manually update this data, which will automatically update the Database.

![A diagram of the system architecture and how it communicates with external services](./arch.jpg)


# Getting started

> This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app), so if you're familiar with the tool you're already know all these commands.


To clone the repository and install everything:

```
git clone git@github.com:cmdalbem/ciclomapa.git
cd ciclomapa
yarn install
```

## Using

To start the local server:

```
yarn start
```

To deploy to production server:

```
yarn run deploy
```


## Contributing

We're using [GitHub Issues](https://github.com/cmdalbem/ciclomapa/issues) for our backlog. Feel free to take a look around and chose the task you want. Use the tags at your advantage:

- `complexity` tags tell you how difficult a task *probably* is.
- `good first issue` is the perfect place to start if you're new to the project, or to coding itself.
- `help wanted` are issues where external help is currently more needed.

After you've chosen your task, you have no doubts on it and you're ready to start coding, follow these steps:

1. Fork this repository.
2. Create a branch: `git checkout -b <branch_name>`.
3. Make your changes and commit them: `git commit -m '<commit_message>'`
4. Push to the original branch: `git push origin <project_name>/<location>`
5. Create the pull request.

Alternatively see the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).


## Contact

<contato@ciclomapa.org.br>


## License
The source code is available under a [GPLv3 license](https://github.com/cmdalbem/ciclomapa/blob/master/LICENSE).

Data is directly imported from [OpenStreetMap®](https://www.openstreetmap.org/) and thus is open data, licensed under the [Open Data Commons Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/) by the [OpenStreetMap Foundation (OSMF)](https://osmfoundation.org/).
