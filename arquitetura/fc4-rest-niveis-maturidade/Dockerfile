FROM node:22.8.0-slim

COPY start.sh /
RUN chmod +x /start.sh

USER node

WORKDIR /home/node/app

EXPOSE 3000

CMD ["/start.sh"] 
