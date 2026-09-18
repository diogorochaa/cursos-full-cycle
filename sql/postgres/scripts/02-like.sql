select * from users 
where name like '%John%';

select * from users 
where name like '%John%' or name like '%Jane%';

select * from users  
order by name asc;

select * from users 
limit 10
offset 10;

update users 
set name = 'John Doe'
where id = 1;

alter table users 
add column email varchar(255);

